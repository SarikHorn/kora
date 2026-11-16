import zipfile
import xml.etree.ElementTree as ET
import json
import re
import html
import os

DOCX_FILE = 'សៀវភៅ Computer for ministry.docx'
ASSETS_IMG_DIR = 'assets/images'

os.makedirs(ASSETS_IMG_DIR, exist_ok=True)

with zipfile.ZipFile(DOCX_FILE, 'r') as z:
    rels_xml = z.read('word/_rels/document.xml.rels')
    rels_tree = ET.fromstring(rels_xml)
    rel_map = {r.get('Id'): r.get('Target') for r in rels_tree}
    
    doc_xml = z.read('word/document.xml')
    doc_tree = ET.fromstring(doc_xml)

ns = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
}

def clean_text(text):
    if not text:
        return ''
    return text.replace('\u00a0', ' ').strip()

def format_shortcut_tags(text):
    pattern = r'\b(Ctrl|Alt|Shift|Enter|Tab|Esc|Windows|Win)\s*\+\s*([A-Za-z0-9\[\]\=\-\+\>\<\_]+(?:\s*\+\s*[A-Za-z0-9\[\]\=\-\+\>\<\_]+)*)'
    return re.sub(pattern, lambda m: f'<kbd class="kbd-key">{m.group(0)}</kbd>', text)

def parse_run(r):
    rPr = r.find('w:rPr', ns)
    t = r.find('w:t', ns)
    text = t.text if t is not None and t.text else ''
    
    if not text:
        return ''
        
    res = html.escape(text)
    if rPr is not None:
        if rPr.find('w:b', ns) is not None:
            res = f'<strong>{res}</strong>'
        if rPr.find('w:i', ns) is not None:
            res = f'<em>{res}</em>'
        if rPr.find('w:u', ns) is not None:
            res = f'<u>{res}</u>'
        if rPr.find('w:strike', ns) is not None:
            res = f'<s>{res}</s>'
        vert = rPr.find('w:vertAlign', ns)
        if vert is not None:
            val = vert.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val')
            if val == 'superscript':
                res = f'<sup>{res}</sup>'
            elif val == 'subscript':
                res = f'<sub>{res}</sub>'
                
    return res

def parse_paragraph(p):
    runs_html = []
    plain_texts = []
    pPr = p.find('w:pPr', ns)
    style = ''
    if pPr is not None:
        pStyle = pPr.find('w:pStyle', ns)
        if pStyle is not None:
            style = pStyle.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val') or ''
            
    # Find all blips in this paragraph
    p_imgs = []
    blips = p.findall('.//{http://schemas.openxmlformats.org/drawingml/2006/main}blip')
    for b in blips:
        embed_id = b.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
        target = rel_map.get(embed_id, '')
        if target and not target.endswith('.wdp'):
            basename = os.path.basename(target)
            p_imgs.append(f'{ASSETS_IMG_DIR}/{basename}')
            
    for child in p:
        tag = child.tag.split('}')[-1]
        if tag == 'r':
            runs_html.append(parse_run(child))
            t = child.find('w:t', ns)
            if t is not None and t.text:
                plain_texts.append(t.text)
                    
    raw_text = clean_text(''.join(plain_texts))
    html_text = ''.join(runs_html).strip()
    
    # If there are images, append image html
    for img in p_imgs:
        img_html = f'<div class="doc-img-wrap"><img src="{img}" class="doc-img" alt="រូបភាពពន្យល់" loading="lazy" onclick="openLightbox(\'{img}\')" /></div>'
        html_text = (html_text + '<br>' + img_html).strip() if html_text else img_html
        
    return style, raw_text, html_text, p_imgs

def parse_table(tbl):
    rows_html = []
    rows = tbl.findall('w:tr', ns)
    for r_idx, r in enumerate(rows):
        cells_html = []
        is_header = (r_idx == 0)
        tag = 'th' if is_header else 'td'
        for c in r.findall('w:tc', ns):
            c_paras = []
            for p in c.findall('w:p', ns):
                _, raw, p_html, _ = parse_paragraph(p)
                if p_html:
                    c_paras.append(p_html)
            cell_content = '<br>'.join(c_paras) if c_paras else '&nbsp;'
            cells_html.append(f'<{tag}>{cell_content}</{tag}>')
        rows_html.append(f'<tr>{" ".join(cells_html)}</tr>')
        
    return f'<div class="table-responsive"><table class="data-table">{" ".join(rows_html)}</table></div>'

# Extract all elements sequentially
body = doc_tree.find('w:body', ns)
raw_elements = []

for child in body:
    tag = child.tag.split('}')[-1]
    if tag == 'p':
        style, raw, p_html, imgs = parse_paragraph(child)
        raw_elements.append({
            'type': 'p',
            'style': style,
            'raw': raw,
            'html': p_html,
            'imgs': imgs
        })
    elif tag == 'tbl':
        tbl_html = parse_table(child)
        raw_elements.append({
            'type': 'tbl',
            'style': 'Table',
            'raw': '',
            'html': tbl_html,
            'imgs': []
        })

print(f'Total raw elements: {len(raw_elements)}')

data = {
    'metadata': {
        'title': 'សៀវភៅកុំព្យូទ័រសម្រាប់ព័ន្ធកិច្ចពួកជំនុំ',
        'subtitle': 'Microsoft Word, PowerPoint, Excel — សម្រាប់និស្សិតសាលាគម្ពីរ គ្រូគង្វាល និងអ្នកបម្រើព្រះ',
        'author': 'គ្រូគង្វាល សារិក ហោន (SARIK HORN)',
        'institution': 'សាលាទេវវិទ្យា CPTIs (CPTIs Theological Seminary)',
        'church': 'ពួកជំនុំបេសកកម្មនៃក្ដីសង្ឃឹម (Hope Mission Church)',
        'scripture': '«ត្រូវ​តែ​ធ្វើ​ការ​ទាំង​អស់​តាម​បែប​គួរ​សម ហើយ​ដោយ​លំដាប់លំដោយ​ផង» — ១ កូរិនថូស ១៤:៤០',
        'coverImage': 'assets/images/image1.png',
        'authorImage': 'assets/images/pc_profile.png'
    },
    'modules': []
}

mod_intro = {
    'id': 'intro',
    'title': 'អារម្ភកថា & មូលដ្ឋានគ្រឹះ',
    'subtitle': 'សេចក្ដីផ្ដើម និងទ្រឹស្ដីកុំព្យូទ័រទូទៅ',
    'shortTitle': 'អារម្ភកថា',
    'icon': 'book',
    'badge': 'សេចក្ដីផ្ដើម',
    'color': '#4F46E5',
    'chapters': []
}

mod_word = {
    'id': 'word',
    'title': 'Microsoft Word',
    'subtitle': 'Term 1 — សម្រាប់ព័ន្ធកិច្ចពួកជំនុំ',
    'shortTitle': 'MS Word',
    'icon': 'word',
    'logo': 'assets/images/image4.png',
    'badge': 'Term 1',
    'color': '#185ABD',
    'chapters': []
}

mod_ppt = {
    'id': 'powerpoint',
    'title': 'Microsoft PowerPoint',
    'subtitle': 'Term 2 — សម្រាប់ព័ន្ធកិច្ចពួកជំនុំ',
    'shortTitle': 'MS PowerPoint',
    'icon': 'powerpoint',
    'logo': 'assets/images/image18.png',
    'badge': 'Term 2',
    'color': '#C43E1C',
    'chapters': []
}

mod_excel = {
    'id': 'excel',
    'title': 'Microsoft Excel',
    'subtitle': 'Term 3 — សម្រាប់ព័ន្ធកិច្ចពួកជំនុំ',
    'shortTitle': 'MS Excel',
    'icon': 'excel',
    'logo': 'assets/images/image25.png',
    'badge': 'Term 3',
    'color': '#107C41',
    'chapters': []
}

current_mod = 'intro'
current_ch = None
current_sec = None
current_tool = None

def parse_tool_fields(raw_text, full_html):
    definition = ''
    procedure = ''
    shortcut = ''
    steps = []
    
    # Check for shortcut in raw text or html
    sc_match = re.search(r'(?:Shortcut(?:\s*Key)?|ផ្លូវកាត់)[\s\:\=]+([^\n\r]+)', raw_text, re.IGNORECASE)
    if sc_match:
        shortcut = sc_match.group(1).strip()
    else:
        ctrl_match = re.search(r'\b(?:Ctrl|Alt|Shift)\s*\+\s*[^\s\,]+(?:\s*\+\s*[^\s\,]+)*', raw_text)
        if ctrl_match:
            shortcut = ctrl_match.group(0).strip()
            
    # Check definition
    def_match = re.search(r'និយមន័យ[\s\:\៖]+([^\n\r]+)', raw_text)
    if def_match:
        definition = def_match.group(1).strip()
        
    # Check procedure
    proc_match = re.search(r'របៀប[\s\:\៖]+([^\n\r]+)', raw_text)
    if proc_match:
        procedure = proc_match.group(1).strip()
        # Parse steps if divided by arrows, tabs, or multiple spaces
        raw_steps = re.split(r'[\→\➔\»\>]+|\s{2,}', procedure)
        steps = [s.strip() for s in raw_steps if s.strip()]
        
    return definition, procedure, shortcut, steps

ch_counter = {'intro': 0, 'word': 0, 'powerpoint': 0, 'excel': 0}
sec_counter = 0

for idx, elem in enumerate(raw_elements):
    raw = elem['raw']
    p_html = elem['html']
    style = elem['style']
    imgs = elem['imgs']
    
    # Module switch detection
    if style == 'Heading1':
        if 'Microsoft Word' in raw:
            current_mod = 'word'
            current_ch = None
            current_sec = None
            current_tool = None
            continue
        elif 'Microsoft PowerPoint' in raw:
            current_mod = 'powerpoint'
            current_ch = None
            current_sec = None
            current_tool = None
            continue
        elif 'Microsoft Excel' in raw:
            current_mod = 'excel'
            current_ch = None
            current_sec = None
            current_tool = None
            continue
        elif 'មាតិកា' in raw or 'Term' in raw:
            continue

    # Intro handling:
    if current_mod == 'intro':
        if style == 'Heading1' and 'អារម្ភកថា' in raw:
            ch_counter['intro'] += 1
            current_ch = {
                'id': 'intro-foreword',
                'title': 'អារម្ភកថា (Foreword)',
                'shortTitle': 'អារម្ភកថា',
                'description': '',
                'html': '',
                'images': imgs.copy(),
                'sections': []
            }
            mod_intro['chapters'].append(current_ch)
            current_sec = {
                'id': 'intro-foreword-sec',
                'title': 'សារលិខិតពីគ្រូគង្វាល សារិក ហោន',
                'html': '',
                'images': imgs.copy(),
                'tools': []
            }
            current_ch['sections'].append(current_sec)
            current_tool = None
            continue
        elif style == 'Heading1' and ('កុំព្យូទ័រគឺជាអ្វី' in raw or 'Computer' in raw):
            ch_counter['intro'] += 1
            current_ch = {
                'id': 'intro-basics',
                'title': 'កុំព្យូទ័រគឺជាអ្វី? (What is a Computer?)',
                'shortTitle': 'មូលដ្ឋានកុំព្យូទ័រ',
                'description': '',
                'html': '',
                'images': imgs.copy(),
                'sections': []
            }
            mod_intro['chapters'].append(current_ch)
            current_sec = None
            current_tool = None
            continue
        elif current_ch and current_ch['id'] == 'intro-basics' and style == 'Heading3':
            sec_counter += 1
            current_sec = {
                'id': f'intro-basics-sec-{sec_counter}',
                'title': raw,
                'html': '',
                'images': imgs.copy(),
                'tools': []
            }
            current_ch['sections'].append(current_sec)
            current_tool = None
            continue
        elif current_ch and current_sec:
            if p_html:
                current_sec['html'] += f'<p>{p_html}</p>'
                if imgs:
                    current_sec['images'].extend(imgs)
            continue
        elif current_ch:
            if p_html:
                current_ch['html'] += f'<p>{p_html}</p>'
                if imgs:
                    current_ch['images'].extend(imgs)
            continue

    # Word, PPT, Excel chapters:
    if style == 'Heading2':
        ch_counter[current_mod] += 1
        ch_num = ch_counter[current_mod]
        current_ch = {
            'id': f'{current_mod}-ch{ch_num}',
            'chNum': ch_num,
            'title': raw,
            'shortTitle': f'ជំពូកទី {ch_num}',
            'tabName': '',
            'description': '',
            'html': '',
            'ribbonImage': '',
            'images': imgs.copy(),
            'sections': []
        }
        m_tab = re.search(r'\(([^\)]+)\)', raw)
        if m_tab:
            current_ch['tabName'] = m_tab.group(1).strip()
            
        if current_mod == 'word':
            mod_word['chapters'].append(current_ch)
        elif current_mod == 'powerpoint':
            mod_ppt['chapters'].append(current_ch)
        elif current_mod == 'excel':
            mod_excel['chapters'].append(current_ch)
            
        current_sec = None
        current_tool = None
        continue

    elif style == 'Heading3':
        sec_counter += 1
        if current_ch is None:
            ch_counter[current_mod] += 1
            current_ch = {
                'id': f'{current_mod}-ch{ch_counter[current_mod]}',
                'chNum': ch_counter[current_mod],
                'title': 'មេរៀនទូទៅ',
                'shortTitle': f'ជំពូក {ch_counter[current_mod]}',
                'tabName': '',
                'description': '',
                'html': '',
                'ribbonImage': '',
                'images': imgs.copy(),
                'sections': []
            }
            if current_mod == 'word':
                mod_word['chapters'].append(current_ch)
            elif current_mod == 'powerpoint':
                mod_ppt['chapters'].append(current_ch)
            elif current_mod == 'excel':
                mod_excel['chapters'].append(current_ch)
                
        current_sec = {
            'id': f'{current_ch["id"]}-sec{len(current_ch["sections"])+1}',
            'secNum': len(current_ch['sections']) + 1,
            'title': raw,
            'html': '',
            'images': imgs.copy(),
            'tools': []
        }
        current_ch['sections'].append(current_sec)
        current_tool = None
        continue

    elif style == 'Heading4':
        if current_sec is None:
            if current_ch is None:
                ch_counter[current_mod] += 1
                current_ch = {
                    'id': f'{current_mod}-ch{ch_counter[current_mod]}',
                    'chNum': ch_counter[current_mod],
                    'title': 'មេរៀនទូទៅ',
                    'shortTitle': f'ជំពូក {ch_counter[current_mod]}',
                    'tabName': '',
                    'description': '',
                    'html': '',
                    'ribbonImage': '',
                    'images': imgs.copy(),
                    'sections': []
                }
                if current_mod == 'word':
                    mod_word['chapters'].append(current_ch)
                elif current_mod == 'powerpoint':
                    mod_ppt['chapters'].append(current_ch)
                elif current_mod == 'excel':
                    mod_excel['chapters'].append(current_ch)
                    
            current_sec = {
                'id': f'{current_ch["id"]}-sec{len(current_ch["sections"])+1}',
                'secNum': len(current_ch['sections']) + 1,
                'title': 'ផ្នែកទូទៅ',
                'html': '',
                'images': imgs.copy(),
                'tools': []
            }
            current_ch['sections'].append(current_sec)
            
        current_tool = {
            'id': f'{current_sec["id"]}-tool{len(current_sec["tools"])+1}',
            'title': raw,
            'definition': '',
            'procedure': '',
            'shortcut': '',
            'steps': [],
            'html': '',
            'images': imgs.copy(),
            'breadcrumbs': [
                mod_word['title'] if current_mod == 'word' else (mod_ppt['title'] if current_mod == 'powerpoint' else mod_excel['title']),
                current_ch['title'],
                current_sec['title'],
                raw
            ]
        }
        current_sec['tools'].append(current_tool)
        continue

    # Content elements
    if current_tool:
        d, p, sc, st = parse_tool_fields(raw, p_html)
        if d and not current_tool['definition']:
            current_tool['definition'] = d
        if p and not current_tool['procedure']:
            current_tool['procedure'] = p
            current_tool['steps'] = st
        if sc and not current_tool['shortcut']:
            current_tool['shortcut'] = sc
            
        if p_html or elem['type'] == 'tbl':
            content_part = elem['html'] if elem['type'] == 'tbl' else f'<p>{p_html}</p>'
            current_tool['html'] += content_part
            if imgs:
                current_tool['images'].extend(imgs)
                
    elif current_sec:
        if p_html or elem['type'] == 'tbl':
            content_part = elem['html'] if elem['type'] == 'tbl' else f'<p>{p_html}</p>'
            current_sec['html'] += content_part
            if imgs:
                current_sec['images'].extend(imgs)
                
    elif current_ch:
        if p_html or elem['type'] == 'tbl':
            content_part = elem['html'] if elem['type'] == 'tbl' else f'<p>{p_html}</p>'
            current_ch['html'] += content_part
            if imgs:
                current_ch['images'].extend(imgs)
                if not current_ch['ribbonImage']:
                    current_ch['ribbonImage'] = imgs[0]

data['modules'] = [mod_intro, mod_word, mod_ppt, mod_excel]

total_chapters = sum(len(m['chapters']) for m in data['modules'])
total_sections = sum(sum(len(c['sections']) for c in m['chapters']) for m in data['modules'])
total_tools = sum(sum(sum(len(s['tools']) for s in c['sections']) for c in m['chapters']) for m in data['modules'])

data['stats'] = {
    'modules': len(data['modules']),
    'chapters': total_chapters,
    'sections': total_sections,
    'tools': total_tools
}

with open('assets/book_data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

with open('assets/book_data.js', 'w', encoding='utf-8') as f:
    f.write('window.BOOK_DATA = ' + json.dumps(data, ensure_ascii=False) + ';')

print('=== Parsing Complete with Images ===')
print(f'Total Modules: {len(data["modules"])}')
print(f'Total Chapters: {total_chapters}')
print(f'Total Sections: {total_sections}')
print(f'Total Tools: {total_tools}')
