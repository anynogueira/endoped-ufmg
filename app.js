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
    btnInstall: document.getElementById('btn-install'),
    btnStart: document.getElementById('btn-start'),
    btnBack: document.getElementById('btn-back'),
    btnRestart: document.getElementById('btn-restart'),
    questionText: document.getElementById('question-text'),
    optionsContainer: document.getElementById('options-container'),
    resultContent: document.getElementById('result-content'),
    clickableHeaders: document.querySelectorAll('.clickable-header')
};

// Initialization
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (elements.btnInstall) {
        elements.btnInstall.style.display = 'block';
    }
});

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
        if (elements.btnInstall) {
            elements.btnInstall.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    if (outcome === 'accepted') {
                        elements.btnInstall.style.display = 'none';
                    }
                    deferredPrompt = null;
                }
            });
        }
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

function cleanEdgeText(text) {
    // Remove the {{ }} markers used in flow.json
    return (text || "Opção").replace(/\{\{|\}\}/g, '').trim();
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
    
    // Manage Node Image
    let nodeImageContainer = document.getElementById('node-image-container');
    if (!nodeImageContainer) {
        nodeImageContainer = document.createElement('div');
        nodeImageContainer.id = 'node-image-container';
        nodeImageContainer.className = 'node-img-container';
        elements.questionText.parentNode.insertBefore(nodeImageContainer, elements.questionText.nextSibling);
    }
    nodeImageContainer.innerHTML = '';
    
    if (node.image) {
        const img = document.createElement('img');
        img.src = node.image;
        img.className = 'node-img';
        img.alt = "";
        nodeImageContainer.appendChild(img);
        nodeImageContainer.style.display = 'flex';
    } else {
        nodeImageContainer.style.display = 'none';
    }

    // Resolve refs and sort options in descending alphabetical order,
    // so equivalent questions always present the same order (e.g. Sim before Não)
    const edges = node.edges
        .map(edge => getNodeFromObj(edge))
        .filter(Boolean)
        .map(edgeObj => ({ edgeObj, label: cleanEdgeText(edgeObj.text) }))
        .sort((a, b) => b.label.localeCompare(a.label, 'pt-BR', { sensitivity: 'base' }));

    edges.forEach(({ edgeObj, label: cleanText }) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-option';
        
        if (edgeObj.image) {
            btn.classList.add('btn-with-image');
            const imgContainer = document.createElement('div');
            imgContainer.className = 'option-img-wrapper';
            const img = document.createElement('img');
            img.src = edgeObj.image;
            img.className = 'option-img';
            img.alt = "";
            imgContainer.appendChild(img);
            btn.appendChild(imgContainer);
        }
        
        const span = document.createElement('span');
        span.textContent = cleanText;
        btn.appendChild(span);
        
        btn.onclick = () => {
            renderNode(edgeObj.to);
        };
        
        elements.optionsContainer.appendChild(btn);
    });

    // Handle initial state of Back button
    elements.btnBack.style.display = nodeHistory.length > 0 ? 'flex' : 'none';

    showScreen('question');
}

function renderAlerts(alerts) {
    let alertsContainer = document.getElementById('result-alerts');
    if (!alertsContainer) {
        alertsContainer = document.createElement('div');
        alertsContainer.id = 'result-alerts';
        alertsContainer.className = 'alert-container';
        elements.resultContent.parentNode.insertBefore(alertsContainer, elements.resultContent);
    }
    alertsContainer.innerHTML = '';

    if (!alerts || alerts.length === 0) {
        alertsContainer.style.display = 'none';
        return;
    }

    alerts.forEach(text => {
        const box = document.createElement('div');
        box.className = 'alert-box';
        box.setAttribute('role', 'alert');

        const icon = document.createElement('span');
        icon.className = 'alert-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '!';

        const body = document.createElement('div');
        body.className = 'alert-body';

        const label = document.createElement('span');
        label.className = 'alert-label';
        label.textContent = 'Atenção';

        const message = document.createElement('p');
        message.className = 'alert-text';
        message.textContent = text;

        body.appendChild(label);
        body.appendChild(message);
        box.appendChild(icon);
        box.appendChild(body);
        alertsContainer.appendChild(box);
    });

    alertsContainer.style.display = 'flex';
}

function renderResult(node) {
    let resultText = node.text || "Sem recomendação específica.";

    elements.resultContent.innerHTML = '';

    // Extract alerts written between double brackets: [[Aviso importante]]
    const alerts = [];
    resultText = resultText.replace(/\[\[([\s\S]*?)\]\]/g, (_, alertText) => {
        const clean = alertText.trim();
        if (clean) alerts.push(clean);
        return ' ';
    }).trim();

    renderAlerts(alerts);
    
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
    
    if (items.length === 0 && alerts.length > 0) {
        // Result was only an alert — no material list to show
        elements.resultContent.style.display = 'none';
        showScreen('result');
        return;
    }

    elements.resultContent.style.display = '';

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
