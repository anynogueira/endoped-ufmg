import json

def get_element_by_path(data, path):
    parts = path.split('/')
    if parts[0] == '#':
        parts = parts[1:]
    current = data
    for part in parts:
        if part == '':
            continue
        if isinstance(current, list):
            current = current[int(part)]
        else:
            current = current[part]
    return current

def analyze():
    with open('flow.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    refs = []
    
    def find_refs(node, path):
        if isinstance(node, dict):
            if "$ref" in node:
                refs.append((path, node["$ref"]))
            else:
                for k, v in node.items():
                    find_refs(v, path + "/" + str(k))
        elif isinstance(node, list):
            for i, v in enumerate(node):
                find_refs(v, path + "/" + str(i))
                
    find_refs(data, "#")
    print(f"Total $refs found: {len(refs)}")
    
    missing_ids = 0
    ref_targets = set()
    for source_path, ref_path in refs:
        target = get_element_by_path(data, ref_path)
        if isinstance(target, dict) and "id" in target:
            ref_targets.add(target["id"])
        else:
            print(f"Target of {ref_path} has NO id! target={str(target)[:50]}")
            missing_ids += 1
            
    print(f"Missing IDs: {missing_ids}")
    return missing_ids

if __name__ == '__main__':
    analyze()
