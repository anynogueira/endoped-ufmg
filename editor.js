// ===== STATE =====
let flowData = null;
let nextNewId = 1;
let renderedNodeEls = new Map();

// ===== DOM HELPERS =====
const $ = (id) => document.getElementById(id);
const el = (tag, cls, attrs) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v;
        else e.setAttribute(k, v);
    });
    return e;
};

// ===== JSON POINTER =====
function resolveJsonPointer(root, pointer) {
    if (!pointer || !pointer.startsWith('#')) return null;
    if (pointer === '#') return root;
    const parts = pointer.replace('#', '').split('/').filter(Boolean);
    let current = root;
    for (const part of parts) {
        if (current == null) return null;
        const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
        current = Array.isArray(current) ? current[parseInt(key)] : current[key];
    }
    return current;
}

// ===== REF RESOLUTION =====
function resolveAllRefs(node, root) {
    if (!node || typeof node !== 'object') return;
    if (node.edges && Array.isArray(node.edges)) {
        node.edges.forEach((edge) => {
            if (edge.to && edge.to.$ref) {
                const target = resolveJsonPointer(root, edge.to.$ref);
                if (target) {
                    edge._wasRef = true;
                    edge._origRef = edge.to.$ref;
                    edge.to = target;
                }
            }
            // Resolve nested
            if (edge.to && !edge.to.$ref) {
                resolveAllRefs(edge.to, root);
            }
        });
    }
}

// ===== REF RECONSTRUCTION =====
function cloneForExport(node, path, seenIds) {
    if (!node || typeof node !== 'object') return node;

    // If this node ID was already serialized, return a $ref
    if (node.id && seenIds.has(node.id)) {
        return { "$ref": seenIds.get(node.id) };
    }
    if (node.id) seenIds.set(node.id, path);

    const clone = {};
    for (const [key, value] of Object.entries(node)) {
        if (key.startsWith('_')) continue; // skip internal props
        if (key === 'edges') {
            clone.edges = (node.edges || []).map((edge, i) => {
                const edgeClone = {};
                for (const [ek, ev] of Object.entries(edge)) {
                    if (ek.startsWith('_')) continue;
                    if (ek === 'to') {
                        edgeClone.to = cloneForExport(ev, `${path}/edges/${i}/to`, seenIds);
                    } else if (ek === 'from') {
                        // Reconstruct from as $ref to parent node
                        edgeClone.from = { "$ref": path };
                    } else {
                        edgeClone[ek] = structuredClone(ev);
                    }
                }
                // Ensure from exists
                if (!edgeClone.from) edgeClone.from = { "$ref": path };
                return edgeClone;
            });
        } else {
            clone[key] = (typeof value === 'object' && value !== null)
                ? structuredClone(value)
                : value;
        }
    }
    return clone;
}

// ===== GENERATE ID =====
function generateId() {
    return `new:${nextNewId++}`;
}

// ===== TOAST =====
let toastTimeout = null;
function showToast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => t.classList.remove('visible'), 2500);
}

// ===== CONFIRM DIALOG =====
function confirmAction(title, message) {
    return new Promise((resolve) => {
        const overlay = el('div', 'dialog-overlay');
        const box = el('div', 'dialog-box');
        box.innerHTML = `<h3>${title}</h3><p>${message}</p>`;
        const actions = el('div', 'dialog-actions');
        const btnCancel = el('button', 'dialog-btn', { text: 'Cancelar' });
        const btnConfirm = el('button', 'dialog-btn dialog-btn--danger', { text: 'Confirmar' });
        btnCancel.onclick = () => { overlay.remove(); resolve(false); };
        btnConfirm.onclick = () => { overlay.remove(); resolve(true); };
        actions.append(btnCancel, btnConfirm);
        box.appendChild(actions);
        overlay.appendChild(box);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) { overlay.remove(); resolve(false); }
        });
        document.body.appendChild(overlay);
    });
}

// ===== STATS =====
function updateStats() {
    if (!flowData) {
        $('stats').textContent = 'Nenhum fluxo carregado';
        return;
    }
    let nodeCount = 0, edgeCount = 0, leafCount = 0, refCount = 0;
    const seen = new Set();
    function walk(n) {
        if (!n || seen.has(n.id)) { if (n && n.id) refCount++; return; }
        seen.add(n.id);
        nodeCount++;
        if (!n.edges || n.edges.length === 0) leafCount++;
        (n.edges || []).forEach((e) => {
            edgeCount++;
            if (e.to) walk(e.to);
        });
    }
    walk(flowData);
    $('stats').innerHTML =
        `<span>Nós: <strong>${nodeCount}</strong></span>` +
        `<span>Arestas: <strong>${edgeCount}</strong></span>` +
        `<span>Resultados: <strong>${leafCount}</strong></span>` +
        `<span>Referências: <strong>${refCount}</strong></span>`;
}

// ===== TREE RENDERING =====
function renderTree() {
    const container = $('tree');
    container.innerHTML = '';
    renderedNodeEls.clear();

    if (!flowData) {
        container.innerHTML = `
            <div class="empty-state">
                <h2>Nenhum fluxo carregado</h2>
                <p>Use "Carregar" para carregar o flow.json do projeto, ou "Importar" para carregar um arquivo.</p>
            </div>`;
        return;
    }

    const rendered = new Set();
    const nodeEl = renderNode(flowData, 0, '#', rendered);
    container.appendChild(nodeEl);
    updateStats();
}

function renderNode(node, depth, path, renderedIds) {
    // Check if this node was already rendered (shared via $ref)
    if (renderedIds.has(node.id)) {
        return renderRefCard(node);
    }
    renderedIds.add(node.id);

    const isLeaf = !node.edges || node.edges.length === 0;
    const wrapper = el('div', 'tree-node');
    wrapper.dataset.nodeId = node.id;

    const card = el('div', `node-card ${isLeaf ? 'node-card--result' : 'node-card--question'}`);

    // === Header ===
    const header = el('div', 'node-header');

    const toggleBtn = el('button', 'toggle-btn', { text: '▼', title: 'Colapsar/Expandir' });
    if (isLeaf) toggleBtn.style.visibility = 'hidden';

    const badge = el('span',
        `node-badge ${isLeaf ? 'node-badge--result' : 'node-badge--question'}`,
        { text: isLeaf ? 'RESULTADO' : 'PERGUNTA' }
    );

    const textInput = el('input', 'node-text-input', {
        value: node.text || '',
        placeholder: 'Texto do nó...',
        title: node.text || ''
    });
    textInput.addEventListener('input', () => {
        node.text = textInput.value;
        textInput.title = textInput.value;
    });

    const actions = el('div', 'node-actions');

    // Image toggle button
    const imgToggle = el('button', 'action-btn', { html: '🖼️', title: 'Imagem do nó' });

    // Add edge button (only for question nodes or to convert leaf into question)
    const addBtn = el('button', 'action-btn action-btn--add', { html: '＋', title: 'Adicionar aresta' });

    // Remove node button
    const removeBtn = el('button', 'action-btn action-btn--danger', { html: '✕', title: 'Remover nó' });

    actions.append(imgToggle, addBtn, removeBtn);
    header.append(toggleBtn, badge, textInput, actions);
    card.appendChild(header);

    // === Image Section ===
    const imageSection = el('div', `node-image-section ${node.image ? '' : 'hidden'}`);
    const imgPreview = el('img', 'image-preview');
    imgPreview.src = node.image || '';
    imgPreview.onerror = () => { imgPreview.style.display = 'none'; };
    imgPreview.onload = () => { imgPreview.style.display = 'block'; };
    if (!node.image) imgPreview.style.display = 'none';

    const imgInput = el('input', 'image-path-input', {
        value: node.image || '',
        placeholder: 'assets/imagem.png'
    });
    imgInput.addEventListener('input', () => {
        node.image = imgInput.value || undefined;
        if (imgInput.value) {
            imgPreview.src = imgInput.value;
        } else {
            imgPreview.style.display = 'none';
            delete node.image;
        }
    });

    const imgClear = el('button', 'action-btn action-btn--danger', { html: '✕', title: 'Remover imagem' });
    imgClear.addEventListener('click', () => {
        delete node.image;
        imgInput.value = '';
        imgPreview.style.display = 'none';
        imageSection.classList.add('hidden');
    });

    imageSection.append(imgPreview, imgInput, imgClear);
    card.appendChild(imageSection);

    imgToggle.addEventListener('click', () => {
        imageSection.classList.toggle('hidden');
    });

    wrapper.appendChild(card);
    renderedNodeEls.set(node.id, wrapper);

    // === Edges Container ===
    const edgesContainer = el('div', 'edges-container');
    if (isLeaf) edgesContainer.classList.add('hidden');

    function renderEdges() {
        edgesContainer.innerHTML = '';
        (node.edges || []).forEach((edge, i) => {
            const edgeItem = renderEdge(edge, node, i, depth, path, renderedIds);
            edgesContainer.appendChild(edgeItem);
        });
    }
    renderEdges();

    wrapper.appendChild(edgesContainer);

    // === Toggle collapse ===
    let collapsed = false;
    toggleBtn.addEventListener('click', () => {
        collapsed = !collapsed;
        toggleBtn.classList.toggle('collapsed', collapsed);
        edgesContainer.classList.toggle('hidden', collapsed);
    });

    // === Add edge ===
    addBtn.addEventListener('click', () => {
        if (!node.edges) node.edges = [];
        const newNode = { text: '', id: generateId(), type: 'NODE', edges: [], color: {} };
        const newEdge = {
            text: 'Nova opção',
            id: generateId(),
            type: 'EDGE',
            color: {},
            fromSide: 'BOTTOM', toSide: 'TOP',
            edgeType: 'ELBOWED', directional: 'UNI',
            to: newNode
        };
        node.edges.push(newEdge);

        // Update badge if it was a leaf
        if (node.edges.length === 1) {
            badge.textContent = 'PERGUNTA';
            badge.className = 'node-badge node-badge--question';
            card.className = 'node-card node-card--question';
            toggleBtn.style.visibility = 'visible';
            edgesContainer.classList.remove('hidden');
        }

        renderEdges();
        updateStats();
        showToast('Aresta adicionada');
    });

    // === Remove node (re-render tree) ===
    removeBtn.addEventListener('click', async () => {
        if (node === flowData) {
            showToast('Não é possível remover o nó raiz');
            return;
        }
        const ok = await confirmAction('Remover nó?', `"${(node.text || '').substring(0, 50)}..." e toda sua subárvore serão removidos.`);
        if (!ok) return;
        // Find parent edge that points to this node and remove it
        removeNodeFromParent(flowData, node.id);
        renderTree();
        showToast('Nó removido');
    });

    return wrapper;
}

function renderEdge(edge, parentNode, index, depth, parentPath, renderedIds) {
    const edgeItem = el('div', 'edge-item');

    const edgeHeader = el('div', 'edge-header');

    const edgeTextInput = el('input', 'edge-text-input', {
        value: edge.text || '',
        placeholder: 'Texto da opção...'
    });
    edgeTextInput.addEventListener('input', () => { edge.text = edgeTextInput.value; });

    const arrow = el('span', 'edge-arrow', { text: '→' });

    const edgeActions = el('div', 'edge-actions');

    // Image toggle
    const edgeImgBtn = el('button', 'action-btn', { html: '🖼️', title: 'Imagem da aresta' });

    // Move up
    const moveUpBtn = el('button', 'action-btn', { html: '↑', title: 'Mover para cima' });
    moveUpBtn.addEventListener('click', () => {
        if (index > 0) {
            [parentNode.edges[index - 1], parentNode.edges[index]] =
                [parentNode.edges[index], parentNode.edges[index - 1]];
            renderTree();
        }
    });

    // Move down
    const moveDownBtn = el('button', 'action-btn', { html: '↓', title: 'Mover para baixo' });
    moveDownBtn.addEventListener('click', () => {
        if (index < parentNode.edges.length - 1) {
            [parentNode.edges[index], parentNode.edges[index + 1]] =
                [parentNode.edges[index + 1], parentNode.edges[index]];
            renderTree();
        }
    });

    // Remove edge
    const removeEdgeBtn = el('button', 'action-btn action-btn--danger', { html: '✕', title: 'Remover aresta' });
    removeEdgeBtn.addEventListener('click', async () => {
        const ok = await confirmAction('Remover aresta?', `A opção "${edge.text || '?'}" e seu nó filho serão removidos.`);
        if (!ok) return;
        parentNode.edges.splice(index, 1);
        renderTree();
        showToast('Aresta removida');
    });

    edgeActions.append(edgeImgBtn, moveUpBtn, moveDownBtn, removeEdgeBtn);
    edgeHeader.append(edgeTextInput, arrow, edgeActions);
    edgeItem.appendChild(edgeHeader);

    // Edge image section
    const edgeImgSection = el('div', `edge-image-section ${edge.image ? '' : 'hidden'}`);
    const edgeImgPreview = el('img', 'image-preview');
    edgeImgPreview.src = edge.image || '';
    edgeImgPreview.onerror = () => { edgeImgPreview.style.display = 'none'; };
    edgeImgPreview.onload = () => { edgeImgPreview.style.display = 'block'; };
    if (!edge.image) edgeImgPreview.style.display = 'none';

    const edgeImgInput = el('input', 'image-path-input', {
        value: edge.image || '',
        placeholder: 'assets/imagem.png'
    });
    edgeImgInput.addEventListener('input', () => {
        edge.image = edgeImgInput.value || undefined;
        if (edgeImgInput.value) {
            edgeImgPreview.src = edgeImgInput.value;
        } else {
            edgeImgPreview.style.display = 'none';
            delete edge.image;
        }
    });

    const edgeImgClear = el('button', 'action-btn action-btn--danger', { html: '✕' });
    edgeImgClear.addEventListener('click', () => {
        delete edge.image;
        edgeImgInput.value = '';
        edgeImgPreview.style.display = 'none';
        edgeImgSection.classList.add('hidden');
    });

    edgeImgSection.append(edgeImgPreview, edgeImgInput, edgeImgClear);
    edgeItem.appendChild(edgeImgSection);

    edgeImgBtn.addEventListener('click', () => {
        edgeImgSection.classList.toggle('hidden');
    });

    // Edge child node
    if (edge.to) {
        const childContainer = el('div', 'edge-child');
        const childPath = `${parentPath}/edges/${index}/to`;
        const childEl = renderNode(edge.to, depth + 1, childPath, renderedIds);
        childContainer.appendChild(childEl);
        edgeItem.appendChild(childContainer);
    }

    return edgeItem;
}

function renderRefCard(node) {
    const card = el('div', 'node-card node-card--ref');
    const content = el('div', 'ref-card-content');
    const icon = el('span', 'ref-icon', { text: '↗' });
    const text = el('span', 'ref-text', { text: `Referência → "${(node.text || '').substring(0, 60)}"` });
    content.append(icon, text);
    card.appendChild(content);

    card.addEventListener('click', () => {
        const target = renderedNodeEls.get(node.id);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.querySelector('.node-card').style.boxShadow = '0 0 0 3px var(--accent-blue)';
            setTimeout(() => {
                target.querySelector('.node-card').style.boxShadow = '';
            }, 2000);
        }
    });

    const wrapper = el('div', 'tree-node');
    wrapper.appendChild(card);
    return wrapper;
}

// ===== REMOVE NODE FROM TREE =====
function removeNodeFromParent(root, targetId) {
    if (!root || !root.edges) return false;
    for (let i = 0; i < root.edges.length; i++) {
        const edge = root.edges[i];
        if (edge.to && edge.to.id === targetId) {
            root.edges.splice(i, 1);
            return true;
        }
        if (edge.to && removeNodeFromParent(edge.to, targetId)) return true;
    }
    return false;
}

// ===== EXPAND / COLLAPSE ALL =====
function setAllCollapsed(collapsed) {
    document.querySelectorAll('.toggle-btn').forEach((btn) => {
        const edgesContainer = btn.closest('.tree-node')?.querySelector(':scope > .edges-container');
        if (edgesContainer && btn.style.visibility !== 'hidden') {
            btn.classList.toggle('collapsed', collapsed);
            edgesContainer.classList.toggle('hidden', collapsed);
        }
    });
}

// ===== LOAD / IMPORT / EXPORT =====
async function loadFromServer() {
    try {
        const resp = await fetch('flow.json');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        resolveAllRefs(data, data);
        flowData = data;
        renderTree();
        showToast('flow.json carregado com sucesso');
    } catch (err) {
        showToast('Erro ao carregar: ' + err.message);
        console.error(err);
    }
}

function loadFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            resolveAllRefs(data, data);
            flowData = data;
            renderTree();
            showToast(`"${file.name}" importado com sucesso`);
        } catch (err) {
            showToast('Erro ao ler JSON: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function exportFlow() {
    if (!flowData) {
        showToast('Nenhum fluxo para exportar');
        return;
    }

    const seenIds = new Map();
    const exported = cloneForExport(flowData, '#', seenIds);

    const jsonStr = JSON.stringify(exported, null, 4);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flow.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('flow.json exportado');
}

// ===== INIT =====
function init() {
    $('btn-load').addEventListener('click', loadFromServer);

    $('btn-import').addEventListener('click', () => $('file-input').click());
    $('file-input').addEventListener('change', (e) => {
        if (e.target.files[0]) loadFromFile(e.target.files[0]);
        e.target.value = '';
    });

    $('btn-export').addEventListener('click', exportFlow);

    $('btn-expand').addEventListener('click', () => setAllCollapsed(false));
    $('btn-collapse').addEventListener('click', () => setAllCollapsed(true));

    renderTree();
}

document.addEventListener('DOMContentLoaded', init);
