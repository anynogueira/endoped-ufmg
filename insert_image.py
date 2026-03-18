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

with open('flow.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

def clean_images(node):
    if isinstance(node, dict):
        if "edges" in node and isinstance(node["edges"], list):
            for edge in node["edges"]:
                if "image" in edge:
                    if edge["image"] == "assets/posterior_lesaointer.png":
                        print(f"Removed image from edge: {edge.get('text')}")
                        del edge["image"]
        for v in node.values():
            clean_images(v)
    elif isinstance(node, list):
        for v in node:
            clean_images(v)

clean_images(data)

def find_node(node, target_path, target_image, current_path=[]):
    if not isinstance(node, dict): return
    
    if "edges" in node and isinstance(node["edges"], list):
        for i, edge in enumerate(node["edges"]):
            edge_text = str(edge.get("text", "")).strip().lower().replace("{{", "").replace("}}", "")
            if len(current_path) < len(target_path):
                target_text = target_path[len(current_path)].lower()
                if edge_text == target_text:
                    if "to" in edge:
                        target_node = edge["to"]
                        if "$ref" in target_node:
                            target_node = get_element_by_path(data, target_node["$ref"])
                        
                        if len(current_path) + 1 == len(target_path):
                            print("FOUND TARGET EDGE!")
                            print(f"Edge text: {edge.get('text')}")
                            edge["image"] = target_image
                            return True
                        else:
                            if find_node(target_node, target_path, target_image, current_path + [edge_text]):
                                return True

# The user wants Posterior -> Não -> Sim -> Sim -> Sim
print("Inserting into new path 1:")
find_node(data, ["posterior", "não", "sim", "sim", "sim"], "assets/posterior_lesaointer.png")
# The user wants Anterior -> Não -> Não -> Sim
print("\nInserting into new path 4:")
find_node(data, ["anterior", "sim"], "assets/anterior_coroaintegra.png")
print("\nInserting into new path 5:")
find_node(data, ["anterior", "não", "não", "sim", "sim", "sim"], "assets/anterior_comlesão_CTatingido.png")
print("\nInserting into new path 6:")
find_node(data, ["anterior", "sim", "não", "não"], "assets/anterior_CTatingido.png")

with open('flow.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=4, ensure_ascii=False)
