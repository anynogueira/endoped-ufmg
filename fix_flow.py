import json
import shutil

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

def fix_flow():
    with open('flow.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    def replace_refs(node):
        if isinstance(node, dict):
            if "$ref" in node:
                target = get_element_by_path(data, node["$ref"])
                node["__ref_id__"] = target["id"]
                del node["$ref"]
            else:
                for v in node.values():
                    replace_refs(v)
        elif isinstance(node, list):
            for v in node:
                replace_refs(v)
                
    replace_refs(data)
    
    def sort_edges(node):
        if isinstance(node, dict):
            if "edges" in node and isinstance(node["edges"], list):
                def sort_key(edge):
                    text = str(edge.get("text", "")).strip()
                    if text == "Sim":
                        return 0
                    if text == "{{Anterior}}":
                        return 0
                    if text == "Anterior":
                        return 0
                    return 1
                node["edges"].sort(key=sort_key)
            
            for v in node.values():
                sort_edges(v)
        elif isinstance(node, list):
            for v in node:
                sort_edges(v)
                
    sort_edges(data)
    
    id_to_new_path = {}
    
    def compute_paths(node, path):
        if isinstance(node, dict):
            if "id" in node:
                id_to_new_path[node["id"]] = path
            for k, v in node.items():
                compute_paths(v, path + "/" + str(k))
        elif isinstance(node, list):
            for i, v in enumerate(node):
                compute_paths(v, path + "/" + str(i))
                
    compute_paths(data, "#")
    
    def restore_refs(node):
        if isinstance(node, dict):
            if "__ref_id__" in node:
                node["$ref"] = id_to_new_path[node["__ref_id__"]]
                del node["__ref_id__"]
            else:
                for v in node.values():
                    restore_refs(v)
        elif isinstance(node, list):
            for v in node:
                restore_refs(v)
                
    restore_refs(data)
    
    with open('flow.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

if __name__ == '__main__':
    shutil.copy('flow.json', 'flow.json.bak')
    fix_flow()
    print("Done!")
