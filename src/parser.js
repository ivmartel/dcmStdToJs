/**
 * DICOM xml parser.
 */
export class DicomXMLParser {

  /**
   * Parse a DICOM standard xml node.
   *
   * @param {Node} partNode The main DOM node.
   * @param {string} origin The origin of the node (optional).
   * @returns {object} An object containing:
   * - name: a lael for the result
   * - origin: the origin of the node
   * - raw: the raw result
   * - data: the adapted result as string
   */
  parseNode(partNode, origin) {
    // get book node
    const book = partNode.querySelector('book');
    if (!book) {
      throw new Error('No book node.');
    }
    // get book label
    const label = book.getAttribute('label');
    if (!label) {
      throw new Error('No book label.');
    }

    // get version
    // 'DICOM PS3.5 2020a - ...'
    const subtitle = book.querySelector('subtitle');
    if (!subtitle) {
      throw new Error('No book subtitle.');
    }
    const prefix = 'DICOM ' + label;
    if (!subtitle.innerHTML.startsWith(prefix)) {
      throw new Error('Missing DICOM standard version prefix.');
    }
    const endIndex = subtitle.innerHTML.indexOf('-');
    const versionStr =
      subtitle.innerHTML.substring(prefix.length, endIndex).trim();
    const version = {
      year: parseInt(versionStr.substring(0, 4), 10),
      letter: versionStr.substring(4)
    };


    let result = null;

    if (label === 'PS3.3') {
      result = parsePs33Node(partNode, origin);
    } else if (label === 'PS3.5') {
      result = parsePs35Node(partNode, origin, version);
    } else if (label === 'PS3.6') {
      result = parsePs36Node(partNode, origin);
    } else if (label === 'PS3.7') {
      result = parsePs37Node(partNode, origin);
    } else {
      throw new Error('Unknown book label: ' + label);
    }

    return result;
  }
}

/**
 * Parse a PS3.3 node: Information Object Definitions (IODs)
 * https://dicom.nema.org/medical/dicom/current/output/chtml/part03/PS3.3.html
 *
 * @param {Node} partNode The main DOM node.
 * @param {string} origin The origin of the node (optional).
 * @returns {object} A result object {name, origin, raw, data}.
 */
function parsePs33Node(partNode, origin) {
  const result = [];
  // CT: https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_A.3.3.html#table_A.3-1
  const iodList = [
    {name: 'CT Image', label: 'table_A.3-1'},
    {name: 'MR Image', label: 'table_A.4-1'},
    // {name: 'NM Image', label: 'table_A.5-1'},
    // {name: 'US Image', label: 'table_A.6-1'},
    // {name: 'PET Image', label: 'table_A.21.3-1'},
    // {
    //   name: 'Segmentation',
    //   label: 'table_A.51-1',
    //   fgLabel: 'table_A.51-2'
    // }
  ];

  for (const iod of iodList) {
    const usageRegex = /M|C/g;
    let fgModulesProperties = null;
    // functional group modules
    if (typeof iod.fgLabel !== 'undefined') {
      const fgModulesDefs = parseModuleListNode(
        partNode.querySelector(getSelector(iod.fgLabel)),
        partNode,
        iod.name + ' Functional Group Macros',
        usageRegex
      );
      fgModulesProperties =
        parseModulesFromList(fgModulesDefs, partNode);
    }
    // IOD modules
    const iodModulesDefs = parseModuleListNode(
      partNode.querySelector(getSelector(iod.label)),
      partNode,
      iod.name + ' IOD Modules',
      usageRegex
    );
    const modulesProperties = parseModulesFromList(
      iodModulesDefs, partNode, fgModulesProperties);

    const typeRegex = /1|1C/g;
    const modules = modulePropertiesListToObject(
      modulesProperties, typeRegex);

    result.push({
      name: iod.name + ' IOD Modules',
      origin: origin,
      raw: modules,
      data: JSON.stringify(modules, null, '  ')
    });
  }
  return result;
}

/**
 * Parse a PS3.5 node: Data Structures and Encoding
 * https://dicom.nema.org/medical/dicom/current/output/chtml/part05/PS3.5.html
 *
 * @param {Node} partNode The main DOM node.
 * @param {string} origin The origin of the node (optional).
 * @param {object} version The version of the standard.
 * @returns {object} A result object {name, origin, raw, data}.
 */
function parsePs35Node(partNode, origin, version) {
  // VRs
  // https://dicom.nema.org/medical/dicom/current/output/chtml/part05/sect_6.2.html#table_6.2-1
  const vrs = parseVrTableNode(
    partNode.querySelector(getSelector('table_6.2-1')),
    'DICOM Value Representations');

  const vrsNames = Object.keys(vrs);

  // replace undefined with null for JSON
  for (let i = 0; i < vrsNames.length; ++i) {
    if (typeof vrs[vrsNames[i]] === 'undefined') {
      vrs[vrsNames[i]] = null;
    }
  }

  const vrsResult = {
    name: 'VRs',
    origin: origin,
    raw: vrs,
    data: JSON.stringify(vrs, null, '  ')
  };

  // 32-bit VL VRs
  // https://dicom.nema.org/medical/dicom/current/output/chtml/part05/chapter_7.html#table_7.1-1
  // table 7.1-1 caption:
  // - before 2019e: 'Data Element with Explicit VR of OB, OD...'
  // - >= 2019e: 'Data Element with Explicit VR other than as shown
  //   in Table 7.1-2'
  let isBefore2019e = true;
  if (version.year > 2019 ||
    (version.year === 2019 && version.letter >= 'e')) {
    isBefore2019e = false;
  }

  let xmlid = 'table_7.1-2';
  if (isBefore2019e) {
    xmlid = 'table_7.1-1';
  }
  const specialVrs = parseVrCaptionNode(
    partNode.querySelector(getSelector(xmlid)),
    'Data Element with Explicit VR');

  let vrVl32s = specialVrs;
  if (!isBefore2019e) {
    vrVl32s = vrsNames.filter(function (item) {
      return !specialVrs.includes(item);
    });
  }

  const vrVl32Result = {
    name: '32-bit VL VRs',
    origin: origin,
    raw: vrVl32s,
    data: JSON.stringify(vrVl32s)
  };

  // Extended or replaced default character repertoire VRs
  // https://dicom.nema.org/medical/dicom/current/output/html/part05.html#sect_6.1.2.2
  const charSetVrs = parseCharSetVrNode(
    partNode.querySelector(getSelector('sect_6.1.2.2')));

  const charSetVrResult = {
    name: 'Character Set VRs',
    origin: origin,
    raw: charSetVrs,
    data: JSON.stringify(charSetVrs)
  };

  return [vrsResult, vrVl32Result, charSetVrResult];
}

/**
 * Parse a PS3.6 node:  Data Dictionary
 * https://dicom.nema.org/medical/dicom/current/output/chtml/part06/PS3.6.html
 *
 * @param {Node} partNode The main DOM node.
 * @param {string} origin The origin of the node (optional).
 * @returns {object} A result object {name, origin, raw, data}.
 */
function parsePs36Node(partNode, origin) {
  let tags36 = [];
  // 0002: DICOM File Meta Elements
  // https://dicom.nema.org/medical/dicom/current/output/chtml/part06/chapter_7.html#table_7-1
  tags36 = tags36.concat(parseTagsTableNode(
    partNode.querySelector(getSelector('table_7-1')),
    partNode,
    'Registry of DICOM File Meta Elements'));
  // 0004: DICOM Directory Structuring Elements
  // https://dicom.nema.org/medical/dicom/current/output/chtml/part06/chapter_8.html#table_8-1
  tags36 = tags36.concat(parseTagsTableNode(
    partNode.querySelector(getSelector('table_8-1')),
    partNode,
    'Registry of DICOM Directory Structuring Elements'));
  // DICOM Data Elements
  // https://dicom.nema.org/medical/dicom/current/output/chtml/part06/chapter_6.html#table_6-1
  tags36 = tags36.concat(parseTagsTableNode(
    partNode.querySelector(getSelector('table_6-1')),
    partNode,
    'Registry of DICOM Data Elements'));

  const tagsResults = {
    name: 'DICOM Tags',
    origin: origin,
    raw: tags36,
    data: stringifyTags(adaptTagsForDwv(tags36))
  };

  // transfer syntax
  // https://dicom.nema.org/medical/dicom/current/output/chtml/part06/chapter_A.html#table_A-1
  const uids = parseUidTableNode(
    partNode.querySelector(getSelector('table_A-1')),
    partNode,
    'UID Values',
    'Transfer Syntax');
  const uidsResults = {
    name: 'Transfer syntax UIDs',
    origin: origin,
    raw: uids,
    data: JSON.stringify(adaptUidsForDwv(uids), null, '  ')
  };

  // SOPs
  // https://dicom.nema.org/medical/dicom/current/output/chtml/part06/chapter_A.html#table_A-1
  const sops = parseUidTableNode(
    partNode.querySelector(getSelector('table_A-1')),
    partNode,
    'UID Values',
    'SOP');
  const sopsResults = {
    name: 'SOP class and instance UIDs',
    origin: origin,
    raw: sops,
    data: JSON.stringify(adaptUidsForDwv(sops), null, '  ')
  };

  return [tagsResults, uidsResults, sopsResults];
}

/**
 * Parse a PS3.7 node: Message Exchange
 * https://dicom.nema.org/medical/dicom/current/output/chtml/part07/PS3.7.html
 *
 * @param {Node} partNode The main DOM node.
 * @param {string} origin The origin of the node (optional).
 * @returns {object} A result object {name, origin, raw, data}.
 */
function parsePs37Node(partNode, origin) {
  let tags37 = [];
  // 0000: command
  // https://dicom.nema.org/medical/dicom/current/output/chtml/part07/chapter_E.html#table_E.1-1
  tags37 = tags37.concat(parseTagsTableNode(
    partNode.querySelector(getSelector('table_E.1-1')),
    partNode,
    'Command Fields'));
  // 0000: command (retired)
  // https://dicom.nema.org/medical/dicom/current/output/chtml/part07/sect_E.2.html#table_E.2-1
  tags37 = tags37.concat(parseTagsTableNode(
    partNode.querySelector(getSelector('table_E.2-1')),
    partNode,
    'Retired Command Fields'));

  return {
    name: 'DICOM tags group 0000',
    origin: origin,
    raw: tags37,
    data: stringifyTags(adaptTagsForDwv(tags37))
  };
}

/**
 * Get a selector for an element with the input xml:id.
 * Looking for:
 * - <table label="l"> when the id starts with 'table_'
 * - <section label="l"> when the id starts with 'sect_'
 *
 * @param {string} xmlid The id to look for.
 * @returns {string} The selector.
 */
function getSelector(xmlid) {
  let prefix = '';
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
 * Looking for: <xref linkend="sect_C.1-7">
 *
 * @param {string} str The input string.
 * @returns {string} The xml:id.
 */
function getLinkend(str) {
  const regex = /linkend="(.+?)"/g;
  const matches = [...str.matchAll(regex)];
  // return first result
  if (matches.length === 0 || matches[0].length !== 2) {
    throw new Error('Cannot find linkend value in: ' + str);
  }
  return matches[0][1];
}

/**
 * Extract enum values from a string
 * (created by parseVariableListNode).
 *
 * @param {string} str The string to extract the enum from.
 * @returns {object} An object containing the input string ('str')
 *   either in full or without the enum if found and
 *   the enum ('enum') if found.
 */
function extractEnum(str) {
  let result = {str: str};

  // looks like: 'enum=ITEM0,ITEM1;'
  const start = str.indexOf('enum=');
  if (start !== -1) {
    const end = str.indexOf(';');
    if (end === -1) {
      throw new Error('Badly formed enum');
    }
    // remove enum from input
    const desc = str.substring(0, start) +
      str.substring(end, str.length - 1);
    result.str = desc.trim();
    // store enum as array
    result.enum = str.substring(start + 5, end).split(',');
  }

  return result;
}

/**
 * Extract condition arguments from a string.
 *
 * @param {string} str The string to extract the condition from.
 * @returns {object} An object containing the input string ('str')
 *   either in full or without the condition if found and
 *   the condition ('condition') if found.
 */
function extractCondition(str) {
  let result = {str: str};

  const reqIndex = str.indexOf('Required if');
  if (reqIndex !== -1) {
    let gotConditionMatch = false;
    // 'Required if Context Identifier (0008,010F) is present.'
    const regex = /Required if ([\w\s]+) (\([\dA-F]{4},[\dA-F]{4}\)) ([\w\s]+)\./g;
    const matches = [...str.matchAll(regex)];
    if (matches.length !== 0 && matches[0].length === 4) {
      if (matches[0][3] === 'is present' ||
        matches[0][3] === 'is not present' ||
        matches[0][3].startsWith('has a value') ||
        matches[0][3].startsWith('is')) {
        gotConditionMatch = true;
        // condition without first match element
        result.condition = matches[0].slice(1);
        // remove condition from input
        result.str = str.replace(matches[0][0], '');
      }
    }

    if (!gotConditionMatch) {
      // condition
      result.condition = str.substring(reqIndex);
      // console.log('Cannot extract condition from: ', result.condition);
      // remove condition from input
      result.str = str.substring(0, reqIndex);
    }
  }
  return result;
}

/**
 * Get a compare function for a specific object property.
 *
 * @param {string} property The object property to sort by.
 * @returns {Function} A compare function.
 */
function getCompare(property) {
  return function (a, b) {
    if (a[property] < b[property]) {
      return -1;
    }
    if (a[property] > b[property]) {
      return 1;
    }
    return 0;
  };
}

/**
 * Get a multi compare function for a list of object properties.
 *
 * @param {Array} properties The list of object properties to sort by.
 * @returns {Function} A compare function.
 */
function getMultiCompare(properties) {
  return function (a, b) {
    let res = null;
    for (let i = 0; i < properties.length; ++i) {
      res = getCompare(properties[i])(a, b);
      // if result is not zero, exit
      if (res !== 0) {
        return res;
      }
    }
    return res;
  };
}

/**
 * Parse a DICOM standard XML table node.
 *
 * @param {Node} tableNode A DOM table node.
 * @param {Node} partNode The main DOM node.
 * @param {string|undefined} expectedCaption Optional expected table caption.
 * @returns {Array} The table property values.
 */
function parseTableNode(tableNode, partNode, expectedCaption) {
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
 * Check a node caption.
 *
 * @param {Node} node A DOM node.
 * @param {string} expectedCaption The expected node caption.
 * @param {boolean} isEqualCheck Bool to perform equal or include
 *   caption text check.
 */
function checkNodeCaption(node, expectedCaption, isEqualCheck) {
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

/**
 * Parse a DICOM standard XML table row node.
 *
 * @param {Node} trNode A DOM row node.
 * @param {Node} partNode The main DOm node.
 * @returns {Array} The row property values.
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
 * @param {Node} tdNode A DOM cell node.
 * @param {Node} partNode The main DOM node.
 * @returns {Array} The cell property values.
 */
function parseTdNode(tdNode, partNode) {
  const properties = [];
  const nodes = tdNode.childNodes;
  if (nodes) {
    for (const node of nodes) {
      // type 1 (elements) to avoid #text between elements
      if (node.nodeType === 1) {
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
 * @param {Node} paraNode A DOM para node.
 * @param {Node} partNode The main DOM node.
 * @returns {string} The para value.
 */
function parseContentNode(paraNode, partNode) {
  let content = '';
  const nodes = paraNode.childNodes;
  if (nodes) {
    for (const node of nodes) {
      if (node.nodeType === 1) {
        // type 1: element
        if (node.nodeName === 'xref') {
          // just keep linkend for xref
          content += 'linkend="' + node.attributes.linkend.value + '"';
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
          if (node.nodeName === 'variablelist') {
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
 * Parse a DICOM standard XML VariableList node
 *
 * @param {Node} listNode A DOM list node.
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
function cleanString(str) {
  return str.trim().replace(/\n/g, '').replace(/\u200B/g, '');
}

/**
 * Parse a DICOM standard XML tags table node.
 *
 * @param {Node} tableNode A DOM table node.
 * @param {Node} partNode The main DOM node.
 * @param {string} expectedCaption The expected node caption.
 * @returns {Array} The list of DICOM tags objects.
 */
function parseTagsTableNode(tableNode, partNode, expectedCaption) {
  const values = parseTableNode(tableNode, partNode, expectedCaption);
  const tags = [];
  let tag = null;
  for (const value of values) {
    tag = tagPropertiesToObject(value);
    if (tag) {
      tags.push(tag);
    }
  }
  return tags;
}

/**
 * Parse a DICOM standard XML UIDs table node.
 *
 * @param {Node} tableNode A DOM table node.
 * @param {Node} partNode The main DOM node.
 * @param {string} expectedCaption The expected node caption.
 * @param {string} uidType The UID type.
 * @returns {object} The list of transfer syntax UIDs.
 */
function parseUidTableNode(tableNode, partNode, expectedCaption, uidType) {
  const values = parseTableNode(tableNode, partNode, expectedCaption);
  const uids = {};
  let uid = null;
  for (const value of values) {
    uid = uidPropertiesToObject(value, uidType);
    if (uid) {
      uids[uid.value] = uid.name;
    }
  }
  return uids;
}

/**
 * Extract a string VR type for a string.
 *
 * @param {string} str Input string.
 * @returns {string|undefined} The type if found or undefined.
 */
function stringVrTypeExtractor(str) {
  let type;
  if (str.startsWith('A string of characters') ||
    str.startsWith('A character string') ||
    str.startsWith('A concatenated date-time character string')) {
    type = 'string';
  }
  return type;
}

/**
 * Extract an octet VR type for a string.
 *
 * @param {string} str Input string.
 * @returns {string|undefined} The type if found or undefined.
 */
function octetVrTypeExtractor(str) {
  let type;
  // pre 2017 uses string and not stream...
  if (str.startsWith('An octet-stream') ||
    str.startsWith('A string of bytes')) {
    type = 'Uint8';
  }
  return type;
}

/**
 * Extract a integer VR type for a string.
 *
 * @param {string} str Input string.
 * @returns {string|undefined} The type if found or undefined.
 */
function intVrTypeExtractor(str) {
  let type;
  const regex = /(Signed|Unsigned) binary integer (\d{2}) bits long/g;
  const match = [...str.matchAll(regex)];
  if (match.length === 1 && match[0].length === 3) {
    type = match[0][1] === 'Unsigned' ? 'Ui' : 'I';
    type += 'nt' + match[0][2];
  }
  return type;
}

/**
 * Extract a float VR type for a string.
 *
 * @param {string} str Input string.
 * @returns {string|undefined} The type if found or undefined.
 */
function floatVrTypeExtractor(str) {
  let type;
  const regex = /IEEE 754:1985 (\d{2})-bit Floating Point Number/g;
  const match = [...str.matchAll(regex)];
  if (match.length === 1 && match[0].length === 2) {
    type = 'Float' + match[0][1];
  }
  return type;
}

/**
 * Extract a word VR type for a string.
 *
 * @param {string} str Input string.
 * @returns {string|undefined} The type if found or undefined.
 */
function wordVrTypeExtractor(str) {
  let type;
  // pre 2017 uses string and not stream...
  const regex = /A (?:stream|string) of (\d{2})-bit words/g;
  const match = [...str.matchAll(regex)];
  if (match.length === 1 && match[0].length === 2) {
    type = 'Uint' + match[0][1];
  }
  return type;
}

/**
 * Extract a flaot word VR type for a string.
 *
 * @param {string} str Input string.
 * @returns {string|undefined} The type if found or undefined.
 */
function floatWordVrTypeExtractor(str) {
  let type;
  const regex = /(\d{2})-bit IEEE 754:1985 floating point words/g;
  const match = [...str.matchAll(regex)];
  if (match.length === 1 && match[0].length === 2) {
    type = 'Uint' + match[0][1];
  }
  return type;
}

/**
 * Parse a VR 32bit VL DICOM standard XML node.
 *
 * @param {Node} tableNode The content node.
 * @param {Node} partNode The main DOM node.
 * @param {string} expectedCaption The expected node caption root.
 * @returns {Array} The list of VRs.
 */
function parseVrTableNode(tableNode, partNode, expectedCaption) {
  const values = parseTableNode(tableNode, partNode, expectedCaption);
  const vrs = {};

  const extractors = [
    stringVrTypeExtractor,
    octetVrTypeExtractor,
    intVrTypeExtractor,
    floatVrTypeExtractor,
    wordVrTypeExtractor,
    floatWordVrTypeExtractor
  ];

  for (const value of values) {
    // 'short' VR name
    let vrName = value[0][0];
    // definition
    let definition = value[1][0];
    let type;
    for (const extractor of extractors) {
      type = extractor(definition);
      // exit if found
      if (typeof type !== 'undefined') {
        break;
      }
    }
    // log unknown types (typically AT and SQ)
    if (typeof type === 'undefined') {
      console.log('Unknown VR type for ' + vrName);
    }
    // store
    vrs[vrName] = type;
  }
  return vrs;
}

/**
 * Parse a module list DICOM standard XML node:
 *   can be an IOD modules list or a functional group macros.
 *
 * @param {Node} node The content node.
 * @param {Node} partNode The main DOM node.
 * @param {string} expectedCaption The expected node caption.
 * @param {string} usageRegex Optional usage selection regex.
 * @returns {Array} The list of IOD modules.
 */
function parseModuleListNode(node, partNode, expectedCaption, usageRegex) {
  const values = parseTableNode(node, partNode, expectedCaption);
  const modules = [];
  let module = null;
  for (const value of values) {
    module = moduleDefinitionPropertiesToObject(value, usageRegex);
    if (module) {
      modules.push(module);
    }
  }
  return modules;
}

/**
 * Get modules from a modules definition list.
 *
 * @param {Array} list The IOD module list.
 * @param {Node} partNode The main DOM node.
 * @param {object} fgModulesProperties Optional functional group
 *   modules properties, undefined to parse a functional group.
 * @returns {Array} The modules array.
 */
function parseModulesFromList(list, partNode, fgModulesProperties) {
  const result = {};
  for (const item of list) {
    // TODO include usage and condition
    const moduleName = item.module;
    // get the module from the referenced section
    const xmlid = getLinkend(item.reference);
    const sectNode = partNode.querySelector(getSelector(xmlid));
    for (const node of sectNode.childNodes) {
      // stop at first table
      if (node.nodeName === 'table') {
        let name = moduleName;
        if (typeof fgModulesProperties === 'undefined') {
          name += ' Macro';
        } else {
          name += ' Module';
        }
        name += ' Attributes';
        result[moduleName] =
          parseModuleAttributesNode(node, partNode, name, fgModulesProperties);
        break;
      }
    }
  }
  return result;
}

let macros = {};

/**
 * Parse a Information Entities (IE) modules DICOM standard XML node.
 *
 * @param {Node} node The content node.
 * @param {Node} partNode The main DOM node.
 * @param {string} expectedCaption The expected node caption.
 * @param {object} fgModules A list of functional group modules.
 * @returns {Array} The list of ....
 */
function parseModuleAttributesNode(node, partNode, expectedCaption, fgModules) {
  // expecting macro includes as: 'Include <xref linkend="table_10-18"
  //   xrefstyle="select: label quotedtitle"/>'
  const includeMacro = 'Include linkend=';
  const includeFG = 'Include one or more Functional Group Macros';

  const rows = parseTableNode(node, partNode, expectedCaption);
  const result = [];
  let startSq0 = false;
  let startSq1 = false;
  for (const row of rows) {
    if (row.length === 0) {
      const nodeCaptions = node.getElementsByTagName('caption');
      if (nodeCaptions && nodeCaptions.length !== 0) {
        console.warn('Empty module row in: ', nodeCaptions[0].innerHTML);
      } else {
        console.warn('Empty module row');
      }
      continue;
    }
    let attribute;
    const attributeName = cleanString(row[0][0]);
    let includeCase = false;

    if (row.length === 4) {
      // default: Attribute Name, Tag, Type, Attribute Description
      attribute = [row];
    } else if (attributeName.includes(includeMacro)) {
      // include module macro
      includeCase = true;
      const xmlid = getLinkend(attributeName);
      if (xmlid.startsWith('table_')) {
        // store macro if not done yet
        if (!macros[xmlid]) {
          const subTable = partNode.querySelector(getSelector(xmlid));
          macros[xmlid] =
            parseModuleAttributesNode(subTable, partNode, undefined);
        }
        attribute = macros[xmlid];
      }
    } else if (attributeName.includes(includeFG)) {
      // include functional group macro
      includeCase = true;
      attribute = [];
      const keys = Object.keys(fgModules);
      for (let key of keys) {
        attribute = attribute.concat(fgModules[key]);
      }
    } else {
      // avoid these rows
      // code sequence: BASIC CODED ENTRY ATTRIBUTES, ENHANCED ENCODING MODE
      if (attributeName !== 'BASIC CODED ENTRY ATTRIBUTES' &&
        attributeName !== 'ENHANCED ENCODING MODE') {
        console.warn('Unexpected row: \'' + attributeName + '\'');
      }
      continue;
    }

    // handle sequences
    if (attributeName.startsWith('>')) {
      // previous attribute (first level)
      let previousAtt = result[result.length - 1];
      // set flag and append array for first item
      if (!startSq0) {
        previousAtt.push([]);
        startSq0 = true;
      }
      // remove '>' from name
      if (!includeCase) {
        attribute[0][0][0] = attribute[0][0][0].substring(1);
      }

      if (attributeName.startsWith('>>')) {
        // previous attribute (second level)
        previousAtt = previousAtt[4][previousAtt[4].length - 1];
        // set flag and append array for first item
        if (!startSq1) {
          previousAtt.push([]);
          startSq1 = true;
        }
      } else {
        // reset second level flag
        if (startSq1) {
          startSq1 = false;
        }
      }
      // append to previous attribute
      previousAtt[4].push(...attribute);
    } else if (attributeName.startsWith('>>>')) {
      console.warn('Not expecting a triple \'>\'');
    } else {
      // reset first level flag
      if (startSq0) {
        startSq0 = false;
      }
      // reset second level flag
      if (startSq1) {
        startSq1 = false;
      }
      // append to result
      result.push(...attribute);
    }
  }

  return result;
}

/**
 * Parse a VR 32bit VL DICOM standard XML node.
 *
 * @param {Node} node The content node.
 * @param {string} expectedCaptionRoot The expected node caption root.
 * @returns {Array} The list VRs.
 */
function parseVrCaptionNode(node, expectedCaptionRoot) {
  // check node
  if (!node) {
    throw new Error('No Vr caption node.');
  }
  // check caption
  checkNodeCaption(node, expectedCaptionRoot, false);
  // expecting something like:
  // 'Data Element with Explicit VR of OB, OW, OF, OD, SQ, UT or UN'
  const regex = /(?:\s)([A-Z]{2})(?:,|\sor|\sand|$)/g;
  const caption = node.getElementsByTagName('caption');
  const text = caption[0].innerHTML;
  const matches = text.matchAll(regex);
  const result = [];
  for (const match of matches) {
    result.push(match[1]); // [0] includes non capturing groups
  }
  return result;
}

/**
 * Parse a Character Set VR DICOM standard XML node.
 *
 * @param {Node} node The content node.
 * @returns {Array} The list of VRs.
 */
function parseCharSetVrNode(node) {
  // check node
  if (!node) {
    throw new Error('No char Vr node.');
  }

  const result = [];

  // expecting something like:
  // For Data Elements with Value Representations of SH (Short String),
  // LO (Long String), UC (Unlimited Characters), ST (Short Text),
  // LT (Long Text), UT (Unlimited Text) or PN (Person Name)
  const regex = /(?:\s)([A-Z]{2})(?:\s\(\w+\s\w+\))/g;
  const paras = node.getElementsByTagName('para');
  for (const para of paras) {
    if (para.innerHTML.startsWith(
      'For Data Elements with Value Representations')) {
      const text = para.innerHTML;
      const matches = text.matchAll(regex);
      for (const match of matches) {
        result.push(match[1]); // [0] includes non capturing groups
      }
    }
  }
  return result;
}

/**
 * Parse tag values as array and return a tag object.
 *
 * @param {Array} properties A tag row array of properties (length=6).
 * @returns {object} A tag object: {group, element, keyword, vr, vm}.
 */
function tagPropertiesToObject(properties) {
  // check length (then only use the first element of each item)
  if (properties.length !== 5 && properties.length !== 6) {
    throw new Error(
      'Not the expected tag properties size: ' + properties.length);
  }
  // split (group,element)
  const geSplit = properties[0][0].split(',');
  const group = geSplit[0].substring(1, 5).toString();
  const element = geSplit[1].substring(0, 4).toString();
  // return
  return {
    group: group,
    element: element,
    keyword: typeof properties[2][0] === 'undefined' ? '' : properties[2][0],
    vr: typeof properties[3][0] === 'undefined' ? '' : properties[3][0],
    vm: typeof properties[4][0] === 'undefined' ? '' : properties[4][0]
  };
}

/**
 * Parse UID values as array and return a UID object.
 *
 * @param {Array} properties A UID row array of properties (length=6).
 * @param {string} uidType The UID type.
 * @returns {object} A tag object: {group, element, keyword, vr, vm}.
 */
function uidPropertiesToObject(properties, uidType) {
  // check length (then only use the first element of each item)
  if (properties.length !== 4 && properties.length !== 5) {
    throw new Error('Not the expected UID values size: ' + properties.length);
  }
  let uid = null;
  // check UID type
  // a 'UID keyword' column was added in 2020d, use len-2 instead of index
  if (properties[properties.length - 2][0].includes(uidType)) {
    uid = {
      name: properties[1][0],
      value: properties[0][0]
    };
  }
  return uid;
}


/**
 * Objectify IOD modules properties.
 *
 * @param {Array} properties The IOD module properties.
 * @param {string} usageRegex Optional usage selection regex.
 * @returns {object} A IOD module object.
 */
function moduleDefinitionPropertiesToObject(properties, usageRegex) {
  // check length (then only use the first element of each item)
  if (properties.length !== 3 && properties.length !== 4) {
    throw new Error('Not the expected IOD module values size: ' +
      properties.length);
  }
  // possible Information Entities (IE) extra first column
  let startCol = 0;
  if (properties.length === 4) {
    startCol = 1;
  }
  let moduleDef = {
    module: properties[startCol][0],
    reference: properties[startCol + 1][0],
    usage: properties[startCol + 2][0]
  };

  // get condition from usage
  if (moduleDef.usage.startsWith('C - Required')) {
    moduleDef.condition = moduleDef.usage.substring(4);
    moduleDef.usage = 'C';
  }

  // Usage property:
  // - M: Mandatory;
  // - C: Conditional;
  // - U: User Option;
  // https://dicom.nema.org/medical/dicom/current/output/chtml/part03/chapter_A.html#sect_A.1.3
  if (moduleDef.usage !== 'M' && moduleDef.usage !== 'C' &&
    moduleDef.usage !== 'U') {
    console.warn('Unexpected IOD module usage: ' + moduleDef.usage);
  }

  // usage filter
  if (typeof usageRegex !== 'undefined' &&
    moduleDef.usage.match(usageRegex) === null) {
    return null;
  }

  return moduleDef;
}

/**
 * Objectify modules properties.
 *
 * @param {Array} properties The module properties.
 * @param {string} typeRegex Optional type selection regex.
 * @returns {object} A module object.
 */
function modulePropertiesListToObject(properties, typeRegex) {
  const keys = Object.keys(properties);
  const result = {};
  for (const key of keys) {
    const modules = [];
    for (const mod of properties[key]) {
      const module = modulePropertiesToObject(mod, typeRegex);
      if (module) {
        modules.push(module);
      }
    }
    if (modules.length !== 0) {
      result[key] = modules;
    }
  }
  return result;
}

/**
 * Objectify modules properties.
 *
 * @param {Array} properties The module properties.
 * @param {string} typeRegex Optional type selection regex.
 * @returns {object} A module object.
 */
function modulePropertiesToObject(properties, typeRegex) {
  // check length (then only use the first element of each item)
  if (properties.length !== 4 && properties.length !== 5) {
    throw new Error('Not the expected module values size: ' +
      properties.length);
  }
  let module = {
    name: properties[0][0],
    tag: properties[1][0],
    type: properties[2][0]
  };

  // Type property:
  // - 1: Required; 1C: Type 1 with condition;
  // - 2: Required, Empty if Unknown; 2C: Type 2 with condition;
  // - 3: Optional
  // https://dicom.nema.org/medical/dicom/current/output/chtml/part05/sect_7.4.html
  if (module.type !== '1' && module.type !== '1C' &&
    module.type !== '2' && module.type !== '2C' &&
    module.type !== '3') {
    console.warn('Unexpected module type: ' + module.type);
  }

  // type filter
  if (typeof typeRegex !== 'undefined' &&
    module.type.match(typeRegex) === null) {
    return null;
  }

  // description
  let desc = '';
  for (let i = 0; i < properties[3].length; ++i) {
    // extract enum
    const extract0 = extractEnum(properties[3][i]);
    if (typeof extract0.enum !== 'undefined') {
      module.enum = extract0.enum;
    }
    if (extract0.str.length !== 0) {
      // extract condition
      const extract1 = extractCondition(extract0.str);
      if (typeof extract1.condition !== 'undefined') {
        module.condition = extract1.condition;
      }
      // keep what's left
      if (extract1.str.length !== 0) {
        if (i !== 0) {
          desc += ' ';
        }
        desc += extract1.str;
      }
    }
  }
  module.desc = desc;

  // include
  if (properties.length === 5) {
    module.items = [];
    const subProperties = properties[4];
    for (const subProps of subProperties) {
      const subModule = modulePropertiesToObject(subProps, typeRegex);
      if (subModule) {
        module.items.push(subModule);
      }
    }
  }

  return module;
}

/**
 * Adapt tags:
 * - replace 'x' in groups and elements
 * - add GenericGroupLength to groups
 * - replace non single VRs
 *
 * @param {Array} inputTags An array of tags.
 * @returns {Array} The adapted tags as a new array.
 */
function adaptTagsForDwv(inputTags) {
  // check tags
  if (!inputTags) {
    throw new Error('No tags.');
  }
  if (inputTags.length === 0) {
    throw new Error('Empty tags.');
  }

  /**
   * Replace 'x's in groups and elements.
   *
   * @param {string} str The input string.
   * @returns {string} The updated string.
   */
  function replaceXs(str) {
    str = str.replace(/xxxxx/g, 'x0004');
    str = str.replace(/xxxx/g, 'x001');
    str = str.replace(/xx/g, '00');
    return str;
  }

  // clone input
  const tags = inputTags.slice();

  // list groups
  const groups = [];
  for (let t = 0; t < tags.length; ++t) {
    // replace 'x's
    tags[t].group = replaceXs(tags[t].group);
    tags[t].element = replaceXs(tags[t].element);
    // list groups
    const grp = tags[t].group;
    if (!groups.includes(grp)) {
      groups.push(grp);
    }
  }

  // add GenericGroupLength to groups
  for (const group of groups) {
    if (group !== '0000' && group !== '0002') {
      tags.push({
        group: group,
        element: '0000',
        keyword: 'GenericGroupLength',
        vr: 'UL',
        vm: '1'
      });
    }
  }

  // sort tags
  tags.sort(getMultiCompare(['group', 'element']));

  // check VRs
  for (let i = 0; i < tags.length; ++i) {
    let vr = tags[i].vr;
    if (typeof vr !== 'undefined') {
      if (vr.length !== 2) {
        if (vr.substring(0, 8) === 'See Note') {
          // #modif "See Note" -> "NONE"
          vr = 'NONE';
        } else if (vr === 'OB or OW') {
          // #modif "OB or OW" -> "ox"
          vr = 'ox';
        } else if (vr === 'US or OW') {
          // #modif "US or OW" -> "xx"
          vr = 'xx';
        } else if (vr === 'US or SS' ||
          vr === 'US or SS or OW') {
          // #modif "US or SS" or "US or SS or OW" -> "xs"
          vr = 'xs';
        } else {
          console.warn('Unknown VR: \'' + vr +
            '\' for ' + tags[i].group + ',' + tags[i].element);
        }
      }
    } else {
      vr = '';
    }
    tags[i].vr = vr;
  }

  return tags;
}

/**
 * Adapt UIDs:
 * - replace '&amp;' in name with '&'
 * - remove comments in name: string after ':'
 *
 * @param {object} inputUids An list of UIDs.
 * @returns {object} The adapted UIDs as a new list.
 */
function adaptUidsForDwv(inputUids) {
  const keys = Object.keys(inputUids);
  for (const key of keys) {
    let name = inputUids[key];
    // replace '&amp'
    if (name.includes('&amp;')) {
      name = name.replace('&amp;', '&');
      inputUids[key] = name;
    }
    // remove comment
    if (name.includes(':')) {
      const pos = name.indexOf(':');
      inputUids[key] = name.substring(0, pos);
    }
  }

  return inputUids;
}

/**
 * Stringify a tags array.
 *
 * @param {Array} tags The tags array.
 * @returns {string} A stringified version of the input array.
 */
function stringifyTags(tags) {
  // check tags
  if (!tags) {
    throw new Error('No tags.');
  }
  if (tags.length === 0) {
    throw new Error('Empty tags.');
  }

  // tabulation
  const tab = '  ';
  const quote = '\'';
  // result text
  let text = '{\n';

  let group = '';
  for (let i = 0; i < tags.length; ++i) {
    const tag = tags[i];
    let isFirstOfgroup = false;
    // start group section
    if (tag.group !== group) {
      isFirstOfgroup = true;
      // close previous
      if (i !== 0) {
        text += '\n' + tab + '},\n';
      }
      // start new
      group = tag.group;
      text += tab + quote + tag.group + quote + ': {\n';
    }

    // tag
    let tagText = isFirstOfgroup ? '' : ',\n';
    tagText += tab + tab +
      quote + tag.element + quote + ': [' +
      quote + tag.vr + quote + ', ' +
      quote + tag.vm + quote + ', ' +
      quote + tag.keyword + quote + ']';
    text += tagText;
  }

  // last group line
  text += '\n' + tab + '}\n';
  // last line
  text += '}\n';

  return text;
}
