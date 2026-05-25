# CLAUDE.md — Contexto do Projeto para Agentes Autônomos

## Visão Geral

**Endoped UFMG** é uma PWA de apoio à decisão clínica para endodontia de dentes decíduos. O app apresenta um fluxograma interativo que guia o dentista por perguntas sobre o caso clínico e recomenda pastas obturadoras ao final.

## Stack Tecnológica

- **HTML/CSS/JS vanilla** — Sem frameworks, sem bundlers, sem transpilação
- **PWA** — Service Worker (`sw.js`) + manifesto (`manifest.json`)
- **Dados** — Árvore de decisão em `flow.json` (JSON estático)
- **Scripts auxiliares** — Python 3 para manipulação do `flow.json`

> **Importante:** Este projeto intencionalmente NÃO usa frameworks. Não introduza React, Vue, build tools, npm, etc., a menos que explicitamente solicitado.

## Arquitetura da Aplicação

### Telas (`index.html`)

4 telas controladas por classes CSS (`screen` / `screen.active`):

1. `#start-screen` — Tela inicial com logos e botão "Instruções"
2. `#instructions-screen` — Orientações ao usuário
3. `#question-screen` — Exibe pergunta atual + opções de resposta
4. `#result-screen` — Resultado com recomendações de materiais

Transições entre telas são feitas pela função `showScreen(screenName)` em `app.js`.

### Motor do Fluxograma (`app.js`)

- **Estado global:** `flowData` (JSON carregado), `currentNode`, `nodeHistory` (pilha para "Voltar")
- **`renderNode(nodeObj)`** — Função principal que renderiza um nó:
  - Se o nó tem `edges` → exibe como pergunta com botões
  - Se o nó NÃO tem `edges` → é um nó folha, exibe como resultado
- **`resolveRef(refString)`** — Resolve referências `$ref` (JSON Pointer) dentro do `flow.json`
- **`getNodeFromObj(obj)`** — Wrapper que resolve `$ref` se presente
- **`renderResult(node)`** — Parseia o texto do resultado para extrair materiais e indicadores de custo (`$`, `$$`, `$$$`)

### Árvore de Decisão (`flow.json`)

Estrutura hierárquica de nós e arestas:

```
Nó raiz: "Tipo de Dente"
├── Aresta "Anterior" → subárvore de dentes anteriores
└── Aresta "Posterior" → subárvore de dentes posteriores
```

Cada nó:
```json
{
  "text": "Pergunta ou resultado",
  "id": "identificador-unico",
  "type": "NODE",
  "edges": [{ "text": "Opção", "to": { ... } }],
  "image": "assets/imagem.png",  // opcional
  "color": "..."                 // metadado visual (não utilizado no app atualmente)
}
```

Mecanismo de `$ref`:
- Subárvores reutilizadas referenciam outros nós via JSON Pointer: `{ "$ref": "#/edges/0/to/edges/1/..." }`
- O app resolve essas referências em runtime via `resolveRef()`

Nós folha (resultados):
- Texto contém nomes de materiais seguidos de `$`, `$$` ou `$$$` indicando custo relativo
- Exemplo: `"Vitapex $$$ Endoflas $$ Hidróxido de cálcio espessada com óxido de zinco $$"`
- O `renderResult()` usa regex para parsear e exibir como lista estilizada

### Service Worker (`sw.js`)

- Versão do cache: `CACHE_NAME = 'endoped-ufmg-v3'`
- Estratégia: **cache-first** com fallback para rede
- **Para forçar atualização após mudanças:** incrementar o valor de `CACHE_NAME`
- Assets pré-cacheados: `index.html`, `style.css`, `app.js`, `flow.json`, `manifest.json`
- ⚠️ Imagens do `assets/` NÃO estão no pré-cache (são cacheadas sob demanda)

### Design (`style.css`)

- Font: Montserrat (Google Fonts)
- Variáveis CSS em `:root` — prefixadas como `--accent-yellow-*`, `--text-*`, `--bg-color`, etc.
- Animação de transição entre telas: `fadeScale` (opacity + translateY)
- Mobile-first, com media query `@media (min-width: 768px)` para ajustes desktop
- Seletores de tela não-ativa usam `display: none`, ativas recebem `display: flex`

## Scripts Python Utilitários

Estes scripts manipulam o `flow.json` e NÃO fazem parte do runtime do app:

### `analyze.py`
Percorre recursivamente o JSON e lista todas as referências `$ref`, verificando se seus alvos possuem `id`.

### `fix_flow.py`
1. Resolve todas as `$ref` temporariamente (substitui por `__ref_id__`)
2. Reordena arestas: "Sim" / "Anterior" aparecem primeiro
3. Recalcula os paths de `$ref` baseado na nova ordenação
4. Restaura as referências com paths atualizados
5. **Cria backup automático** (`flow.json.bak`) antes de sobrescrever

### `insert_image.py`
Navega pela árvore seguindo caminhos textuais (ex: `["posterior", "não", "sim"]`) para inserir propriedades `image` em arestas específicas.

## Convenções

### Idioma
- Interface e conteúdo clínico em **Português (pt-BR)**
- Código (variáveis, funções, comentários) em **Inglês**
- Commits em **Português ou Inglês** (sem padrão rígido)

### Estilo de Código
- JavaScript: `camelCase` para variáveis/funções, sem modules (tudo global em `app.js`)
- CSS: `kebab-case` para classes, BEM-like para componentes (`.btn-option`, `.btn-pill`)
- HTML: IDs em `kebab-case` (`#start-screen`, `#btn-to-instructions`)

### Fluxograma
- Ao modificar o `flow.json`, rodar `python3 analyze.py` para validar referências
- Após reordenar arestas, usar `python3 fix_flow.py` para recalcular `$ref` paths
- Todo nó deve ter um `id` único

## Gotchas e Cuidados

1. **`$ref` é frágil** — Qualquer reordenação de nós ou arestas no `flow.json` quebra todas as referências `$ref` existentes. Use `fix_flow.py` após qualquer reestruturação.

2. **Cache do Service Worker** — Após alterações em arquivos cacheados, é OBRIGATÓRIO incrementar `CACHE_NAME` em `sw.js`. Caso contrário, usuários verão a versão antiga.

3. **Imagens não pré-cacheadas** — As imagens em `assets/` não estão na lista de pré-cache do Service Worker. Elas só ficam disponíveis offline após serem acessadas pelo menos uma vez online.

4. **Sem servidor de build** — O projeto roda diretamente. Não há `npm install`, `npm run build`, etc. Para testar localmente: `python3 -m http.server 8000`.

5. **Regex de custo no resultado** — O parser de resultados (`renderResult`) depende do formato `NomeMaterial $$$`. Se o formato mudar, o parser pode quebrar silenciosamente.

6. **Estado global** — `flowData`, `currentNode` e `nodeHistory` são variáveis globais em `app.js`. Não há gerenciamento de estado sofisticado.

7. **Viewport mobile** — O `<meta viewport>` inclui `user-scalable=no` e `maximum-scale=1.0` para comportamento de app nativo. Não remover sem motivo.

8. **Header clicável** — Os headers com classe `.clickable-header` funcionam como botão "Home" (chamam `resetFlow`). Isso não é óbvio pelo HTML.

## Editor do Fluxograma (`editor.html`)

Ferramenta de administração separada para editar o `flow.json` visualmente. **Não faz parte do app principal** — é acessível apenas via `http://localhost:PORT/editor.html`.

### Arquivos
- `editor.html` — Página standalone do editor
- `editor.css` — Estilos do painel admin (dark toolbar, tree view)
- `editor.js` — Lógica completa: load, render, edit, export

### Arquitetura

**Ao carregar:**
1. Faz `fetch('flow.json')` ou recebe arquivo via import
2. Resolve TODOS os `$ref` recursivamente (`resolveAllRefs`) — edges que tinham `$ref` em `to` agora apontam diretamente para o nó JS real
3. Marca edges que tinham `$ref` com `_wasRef = true`
4. Renderiza a árvore recursivamente, usando um `Set<id>` para detectar nós compartilhados

**Nós compartilhados (referências):**
- Nós que aparecem em mais de um lugar (via `$ref` no original) são o mesmo objeto JS
- A primeira ocorrência renderiza o nó completo
- Ocorrências subsequentes renderizam um card azul "Referência → [texto]" clicável que scrolla até o original

**Ao exportar (`cloneForExport`):**
1. Percorre a árvore, clonando cada nó
2. Mantém um `Map<id, jsonPath>` dos nós já serializados
3. Primeira ocorrência: serializa inline com path registrado
4. Ocorrências seguintes: substitui por `{ "$ref": path_da_primeira_ocorrencia }`
5. Reconstrói o campo `from` de cada edge como `{ "$ref": path_do_nó_pai }`
6. Remove propriedades internas (`_wasRef`, `_origRef`)

### Funcionalidades
- Edição inline de textos de nós e arestas
- Adicionar/remover imagens (por path relativo, ex: `assets/foto.png`)
- Adicionar/remover nós e arestas
- Reordenar arestas (↑/↓)
- Colapsar/expandir subárvores
- Barra de estatísticas (nós, arestas, resultados, referências)
- Import/export de JSON com reconstrução automática de `$ref`

### Cuidados
- O editor **não faz upload de imagens** — o usuário deve colocar a imagem em `assets/` manualmente
- IDs de novos nós seguem o formato `new:N` — diferente dos IDs originais do Figma (`1:2`, `8:990`)
- Após exportar e substituir o `flow.json`, lembrar de incrementar `CACHE_NAME` no `sw.js`

## Repositório Git

- **Origin:** `git@github.com:fm4teus/endoped-ufmg.git` (fork)
- **Upstream:** `git@github.com:anynogueira/endoped-ufmg.git` (repositório original)
- **Branch principal:** `main`

## Como Testar

```bash
# Servir localmente
python3 -m http.server 8000

# Abrir no navegador
# http://localhost:8000

# Validar referências do fluxograma
python3 analyze.py
```

Não há testes automatizados. A validação é manual, navegando pelo fluxograma no navegador.
