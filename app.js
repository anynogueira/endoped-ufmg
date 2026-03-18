// App state
let flowData = null;
let currentNode = null;
let nodeHistory = [];

// DOM Elements
const screens = {
    start: document.getElementById('start-screen'),
    instructions: document.getElementById('instructions-screen'),
    question: document.getElementById('question-screen'),
    result: document.getElementById('result-screen')
};

const elements = {
    loading: document.getElementById('loading'),
    btnToInstructions: document.getElementById('btn-to-instructions'),
    btnStart: document.getElementById('btn-start'),
    btnBack: document.getElementById('btn-back'),
    btnRestart: document.getElementById('btn-restart'),
    questionText: document.getElementById('question-text'),
    optionsContainer: document.getElementById('options-container'),
    resultContent: document.getElementById('result-content'),
    clickableHeaders: document.querySelectorAll('.clickable-header')
};

// Initialization
async function initApp() {
    showLoading(true);
    try {
        const response = await fetch('flow.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        flowData = await response.json();
        
        // Setup event listeners
        if (elements.btnToInstructions) elements.btnToInstructions.addEventListener('click', showInstructions);
        if (elements.btnStart) elements.btnStart.addEventListener('click', startFlow);
        if (elements.btnBack) elements.btnBack.addEventListener('click', goBack);
        if (elements.btnRestart) elements.btnRestart.addEventListener('click', resetFlow);
        
        // Home buttons (Headers)
        if (elements.clickableHeaders) {
            elements.clickableHeaders.forEach(header => {
                header.addEventListener('click', resetFlow);
            });
        }
        
        showScreen('start');
    } catch (error) {
        console.error("Error loading flow data:", error);
        elements.questionText.textContent = "Erro ao carregar o fluxograma. Verifique sua conexão.";
        showScreen('question');
    } finally {
        showLoading(false);
    }
}

// Navigation
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function showLoading(show) {
    if (show) {
        elements.loading.classList.remove('hidden');
    } else {
        elements.loading.classList.add('hidden');
    }
}

// Flow Logic
function showInstructions() {
    showScreen('instructions');
}

function startFlow() {
    nodeHistory = [];
    renderNode(flowData);
}

function resetFlow() {
    showScreen('start');
}

function goBack() {
    if (nodeHistory.length > 0) {
        const previousNode = nodeHistory.pop();
        renderNode(previousNode, false);
    } else {
        resetFlow();
    }
}

function resolveRef(refString) {
    if (!refString.startsWith('#')) return null;
    
    if (refString === '#') return flowData;
    
    // Split the path, ignoring the first '#' and empty parts (like leading '/')
    const parts = refString.replace('#', '').split('/').filter(p => p);
    
    let current = flowData;
    for (const part of parts) {
        if (current === undefined || current === null) return null;
        
        // Handle array indices and object keys
        // Decode URL-encoded characters in JSON pointers (e.g., ~1 for /, ~0 for ~)
        const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
        current = current[key];
    }
    return current;
}

function getNodeFromObj(obj) {
    // If the object is a reference, resolve it
    if (obj && obj['$ref']) {
        return resolveRef(obj['$ref']);
    }
    return obj;
}

function renderNode(nodeObj, addToHistory = true) {
    let node = getNodeFromObj(nodeObj);
    
    if (!node) {
        console.error("Node not found or invalid reference", nodeObj);
        return;
    }
    
    // If we are moving forward, save the current node to history
    if (addToHistory && currentNode) {
        nodeHistory.push(currentNode);
    }
    
    currentNode = node;

    // Check if it's a leaf node (result)
    // A leaf node typically has no edges, or edges is empty array
    if (!node.edges || node.edges.length === 0) {
        renderResult(node);
        return;
    }

    // It is a question node
    elements.questionText.textContent = node.text || "Pergunta não encontrada";
    elements.optionsContainer.innerHTML = '';

    node.edges.forEach(edge => {
        // Resolve edge if it's a ref (though usually edges are inline in this JSON, 'to' is usually inline or a ref)
        const edgeObj = getNodeFromObj(edge);
        
        const btn = document.createElement('button');
        btn.className = 'btn btn-option';
        
        // Remove {{ and }} from edge text if present, as they seem to indicate special formatting in some apps
        const cleanText = (edgeObj.text || "Opção").replace(/\{\{|\}\}/g, '');
        btn.textContent = cleanText;
        
        btn.onclick = () => {
            // "to" can be a ref or a full node object
            renderNode(edgeObj.to);
        };
        
        elements.optionsContainer.appendChild(btn);
    });

    // Handle initial state of Back button
    elements.btnBack.style.display = nodeHistory.length > 0 ? 'flex' : 'none';

    showScreen('question');
}

function renderResult(node) {
    let resultText = node.text || "Sem recomendação específica.";
    
    elements.resultContent.innerHTML = '';
    
    // Parse recommendations
    // The format seems to vary between items separated by $$ or spaces
    // Let's use a regex to extract items and their price rating ($$ or $)
    // Example: "Vitapex $$$ Endoflas $$ Hidróxido de cálcio espessada com óxido de zinco $$ Guedes-Pinto $$"
    
    // Regex matches text followed optionally by one or more $ signs
    const regex = /([^$]+)(\$+)?/g;
    let match;
    const items = [];
    
    while ((match = regex.exec(resultText)) !== null) {
        if (match[1].trim()) {
            items.push({
                name: match[1].trim(),
                price: match[2] || ''
            });
        }
    }
    
    if (items.length > 0) {
        const ul = document.createElement('ul');
        ul.className = 'recommendation-list';
        
        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'recommendation-item';
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'item-name';
            nameSpan.textContent = item.name;
            
            li.appendChild(nameSpan);
            
            if (item.price) {
                const priceContainer = document.createElement('div');
                priceContainer.className = 'price-indicator';
                priceContainer.title = `Custo: ${item.price.length} de 3`;
                
                // Show max 3 dollar signs visually, grey out the ones not active
                const maxPrice = 3; 
                for(let i = 0; i < maxPrice; i++) {
                    const icon = document.createElement('span');
                    icon.textContent = '$';
                    icon.className = i < item.price.length ? 'price-active' : 'price-inactive';
                    priceContainer.appendChild(icon);
                }
                
                li.appendChild(priceContainer);
            }
            
            ul.appendChild(li);
        });
        
        elements.resultContent.appendChild(ul);
    } else {
        elements.resultContent.textContent = resultText;
    }
    
    showScreen('result');
}

// Start
document.addEventListener('DOMContentLoaded', initApp);
