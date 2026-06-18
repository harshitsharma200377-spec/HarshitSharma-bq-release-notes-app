import re
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template
import requests
from bs4 import BeautifulSoup

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def parse_release_notes():
    try:
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
    except Exception as e:
        print(f"Error fetching feed: {e}")
        return []

    try:
        # Standard Atom namespace
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        root = ET.fromstring(response.content)
        
        releases = []
        for entry in root.findall('atom:entry', ns):
            title = entry.find('atom:title', ns).text
            entry_id = entry.find('atom:id', ns).text
            updated = entry.find('atom:updated', ns).text
            
            link_elem = entry.find('atom:link[@rel="alternate"]', ns)
            link = link_elem.get('href') if link_elem is not None else ""
            
            content_elem = entry.find('atom:content', ns)
            raw_html = content_elem.text if content_elem is not None else ""
            
            # Use BeautifulSoup to parse categories/types inside the HTML (e.g. <h3>Feature</h3>, <h3>Announcement</h3>)
            # This allows us to break down a single date's release note into individual itemized updates
            soup = BeautifulSoup(raw_html, 'html.parser')
            
            items = []
            current_type = "General"
            current_paragraphs = []
            
            # Iterate through the elements to split by type headers (<h3>)
            for child in soup.children:
                if child.name == 'h3':
                    # If we already have accumulated paragraphs, save them before starting a new section
                    if current_paragraphs:
                        items.append({
                            'type': current_type,
                            'content': "".join(str(p) for p in current_paragraphs),
                            'text': "".join(p.get_text() for p in current_paragraphs)
                        })
                        current_paragraphs = []
                    current_type = child.get_text().strip()
                elif child.name:
                    current_paragraphs.append(child)
            
            # Append the last section
            if current_paragraphs:
                items.append({
                    'type': current_type,
                    'content': "".join(str(p) for p in current_paragraphs),
                    'text': "".join(p.get_text() for p in current_paragraphs)
                })
            
            # If no items were parsed or standard parsing didn't find h3 headers, just keep the raw content as one general item
            if not items:
                items.append({
                    'type': 'General',
                    'content': raw_html,
                    'text': soup.get_text()
                })
                
            releases.append({
                'date': title,
                'id': entry_id,
                'updated': updated,
                'link': link,
                'items': items
            })
            
        return releases
    except Exception as e:
        print(f"Error parsing feed: {e}")
        return []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    releases = parse_release_notes()
    return jsonify(releases)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
