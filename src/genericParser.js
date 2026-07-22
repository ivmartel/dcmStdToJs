/**
 * Parse a DICOM standard XML table node.
 *
 * @param {Element} tableNode A DOM table node.
 * @param {Document} partNode The main DOM node.
 * @param {string} [expectedCaption] Optional expected table caption.
 * @returns {string[][][]} The table property values.
 */
export function parseTableNode(tableNode, partNode, expectedCaption) {
  // check node
  if (!tableNode) {
    throw new Error('No table node.');
  }
  // check caption
  if (typeof expectedCaption !== 'undefined') {
    checkNodeCaption(tableNode, expectedCaption);
  }
  // parse node rows
  const properties = [];
  const nodes = tableNode.querySelectorAll('tbody > tr');
  if (nodes) {
    for (const node of nodes) {
      properties.push(parseTrNode(node, partNode));
    }
  }
  return properties;
}

/**
 * Parse a DICOM standard XML table row node.
 *
 * @param {Element} trNode A DOM row node.
 * @param {Document} partNode The main DOm node.
 * @returns {string[][]} The row property values.
 */
function parseTrNode(trNode, partNode) {
  const properties = [];
  const nodes = trNode.querySelectorAll('td');
  if (nodes) {
    for (const node of nodes) {
      properties.push(parseTdNode(node, partNode));
    }
  }
  // return
  return properties;
}

/**
 * Parse a DICOM standard XML table row cell node.
 *
 * @param {Element} tdNode A DOM cell node.
 * @param {Document} partNode The main DOM node.
 * @returns {string[]} The cell property values.
 */
function parseTdNode(tdNode, partNode) {
  const properties = [];
  const nodes = tdNode.childNodes;
  if (nodes) {
    for (const node of nodes) {
      // type 1 (elements) to avoid #text between elements
      if (node instanceof Element) {
        if (node.nodeName === 'variablelist') {
          properties.push(parseVariableListNode(node));
        } else {
          properties.push(parseContentNode(node, partNode));
        }
      }
    }
  }
  // return
  return properties;
}

/**
 * Parse a DICOM standard XML table row cell content node,
 * mainly para and note.
 *
 * @param {Element} paraNode A DOM para node.
 * @param {Document} partNode The main DOM node.
 * @returns {string} The para value.
 */
function parseContentNode(paraNode, partNode) {
  let content = '';
  const nodes = paraNode.childNodes;
  if (nodes) {
    for (const node of nodes) {
      if (node instanceof Element) {
        // type 1: element
        if (node.nodeName === 'xref') {
          // just keep linkend for xref
          content += 'linkend="' + node.getAttribute('linkend') + '"';
        } else {
          content += parseContentNode(node, partNode);
        }
      } else if (node.nodeType === 3) {
        // type 3: text
        content += node.textContent;
      } else {
        console.warn('Un-anticipated node:' + node);
      }
    }
  }
  // clean
  content = cleanString(content);

  // link to section with defined terms
  // (for ex in module attributes description)
  const regex = /See linkend=.+ for Defined Terms\./g;
  const match = content.match(regex);
  if (match && match.length === 1) {
    let foundTermsList = false;
    const xmlid = getLinkend(content);
    if (xmlid.startsWith('sect_')) {
      const subSection = partNode.querySelector(getSelector(xmlid));
      const nodes = subSection.childNodes;
      if (nodes) {
        for (const node of nodes) {
          if (node instanceof Element && node.nodeName === 'variablelist') {
            if (!foundTermsList) {
              foundTermsList = true;
              content = content.replace(match[0], parseVariableListNode(node));
            } else {
              console.warn('Multiple variable list for ' + xmlid);
            }
          }
        }
      }
    }
    if (!foundTermsList) {
      console.warn('Did not find terms list with: ' + content);
    }
  }

  // return
  return content;
}

/**
 * Parse a DICOM standard XML VariableList node.
 *
 * @param {Element} listNode A DOM list node.
 * @returns {string} The list values.
 */
function parseVariableListNode(listNode) {
  let content = 'enum=';
  const listChilds = listNode.childNodes;
  if (listChilds) {
    for (const node of listChilds) {
      if (node.nodeName === 'varlistentry') {
        const entries = node.childNodes;
        if (entries) {
          for (const entryNode of entries) {
            if (entryNode.nodeName === 'term') {
              content += cleanString(entryNode.textContent) + ',';
            }
          }
        }
      }
    }
  }
  // replace last comma with semicolon
  return content.replace(/,$/, ';');
}

/**
 * Trim and get rid of new line and zero-width space.
 *
 * @param {string} str The input string.
 * @returns {string} The cleaned string.
 */
export function cleanString(str) {
  return str.trim().replace(/\n/g, '').replace(/\u200B/g, '');
}

/**
 * Get a selector for an element with the input xml:id.
 * Looking for:
 *   - <table label="l"> when the id starts with 'table_',
 *   - <section label="l"> when the id starts with 'sect_'.
 *
 * @param {string} xmlid The id to look for.
 * @returns {string} The selector.
 */
export function getSelector(xmlid) {
  let prefix;
  if (xmlid.startsWith('table_')) {
    prefix = 'table[label=\'' + xmlid.substring(6);
  } else if (xmlid.startsWith('sect_')) {
    prefix = 'section[label=\'' + xmlid.substring(5);
  } else {
    throw new Error('Unknown xml:id format.');
  }
  return prefix + '\']';
}

/**
 * Get the 'linkend' value (an xml:id) of an input string.
 * Looking for: <xref linkend="sect_C.1-7">.
 *
 * @param {string} str The input string.
 * @returns {string} The xml:id.
 */
export function getLinkend(str) {
  const regex = /linkend="(.+?)"/g;
  const matches = [...str.matchAll(regex)];
  // return first result
  if (matches.length === 0 || matches[0].length !== 2) {
    throw new Error('Cannot find linkend value in: ' + str);
  }
  return matches[0][1];
}

/**
 * Check a node caption.
 *
 * @param {Element} node A DOM node.
 * @param {string} expectedCaption The expected node caption.
 * @param {boolean} [isEqualCheck] Optional bool to perform equal or include
 *   caption text check.
 */
export function checkNodeCaption(node, expectedCaption, isEqualCheck) {
  if (typeof isEqualCheck === 'undefined') {
    isEqualCheck = true;
  }
  const captions = node.getElementsByTagName('caption');
  if (!captions) {
    throw new Error('No node caption.');
  }
  if (captions.length === 0) {
    throw new Error('Empty node caption.');
  }
  const text = captions[0].innerHTML;
  if (isEqualCheck) {
    if (text !== expectedCaption) {
      if (text.toLowerCase() === expectedCaption.toLowerCase()) {
        console.warn('Accepting caption with different case: ' +
          expectedCaption);
      } else {
        throw new Error(
          'The node caption is not the expected one: ' +
          expectedCaption + ' != ' + text);
      }
    }
  } else {
    if (!text.includes(expectedCaption)) {
      throw new Error(
        'The node caption does not include the expected one: ' +
        expectedCaption + ' != ' + text);
    }
  }
}