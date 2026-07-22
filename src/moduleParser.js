import {
  cleanString,
  getSelector,
  getLinkend,
  parseTableNode
} from './genericParser.js';

/**
 * @import {DicomParseResult} from './parser.js';
 */

/**
 * DICOM Module class.
 */
export class DicomModule {
  /**
   * @type {string}
   */
  name;
  /**
   * @type {DicomModuleAttribute[]}
   */
  attributes;
}

/**
 * DICOM Module attribute class.
 */
export class DicomModuleAttribute {
  /**
   * @type {string}
   */
  name;
  /**
   * @type {string}
   */
  type;
  /**
   * @type {string}
   */
  tag;
  /**
   * @type {string}
   */
  enum;
  /**
   * @type {string}
   */
  condition;
  /**
   * @type {string}
   */
  desc;
  /**
   * @type {DicomModuleAttribute[]}
   */
  items;
}

/**
 * Parse a PS3.3 node: Information Object Definitions (IODs).
 * See: {@link https://dicom.nema.org/medical/dicom/current/output/chtml/part03/PS3.3.html}.
 *
 * @param {Document} partNode The main DOM node.
 * @param {string} [origin] Optional node origin.
 * @returns {DicomParseResult[]} A result object {name, origin, raw, data}.
 */
export function parsePs33Node(partNode, origin) {
  const result = [];
  // cache of macro tables, local to this parse call so it cannot
  // leak stale content across different partNode/version parses
  const macros = {};
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
        parseModulesFromList(fgModulesDefs, partNode, undefined, macros);
    }
    // IOD modules
    const iodModulesDefs = parseModuleListNode(
      partNode.querySelector(getSelector(iod.label)),
      partNode,
      iod.name + ' IOD Modules',
      usageRegex
    );
    const modulesProperties = parseModulesFromList(
      iodModulesDefs, partNode, fgModulesProperties, macros);

    const typeRegex = /1|1C/g;
    const modules = modulePropertiesListToObject(
      modulesProperties, typeRegex);

    result.push({
      name: iod.name + ' IOD Modules',
      origin: origin,
      raw: modules,
      data: JSON.stringify(simplifyModules(modules), null, '  ')
    });
  }
  return result;
}

/**
 * Parse a module list DICOM standard XML node:
 *   can be an IOD modules list or a functional group macros.
 *
 * @param {Element} node The content node.
 * @param {Document} partNode The main DOM node.
 * @param {string} expectedCaption The expected node caption.
 * @param {RegExp} [usageRegex] Optional usage selection regex.
 * @returns {Array} The list of IOD modules.
 */
function parseModuleListNode(node, partNode, expectedCaption, usageRegex) {
  const values = parseTableNode(node, partNode, expectedCaption);
  const modules = [];
  let module;
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
 * @param {Document} partNode The main DOM node.
 * @param {object} [fgModulesProperties] Optional functional group
 *   modules properties, undefined to parse a functional group.
 * @param {object} macros Cache of macro tables, local to the parent
 *   parsePs33Node call.
 * @returns {object} The map of module name to module attributes.
 */
function parseModulesFromList(list, partNode, fgModulesProperties, macros) {
  const result = {};
  for (const item of list) {
    // TODO include usage and condition
    const moduleName = item.module;
    // get the module from the referenced section
    const xmlid = getLinkend(item.reference);
    const sectNode = partNode.querySelector(getSelector(xmlid));
    for (const node of sectNode.childNodes) {
      // stop at first table
      if (node instanceof Element && node.nodeName === 'table') {
        let name = moduleName;
        if (typeof fgModulesProperties === 'undefined') {
          name += ' Macro';
        } else {
          name += ' Module';
        }
        name += ' Attributes';
        result[moduleName] = parseModuleAttributesNode(
          node, partNode, name, fgModulesProperties, macros);
        break;
      }
    }
  }
  return result;
}

/**
 * Extract enum values from a string
 *   (created by parseVariableListNode).
 *
 * @param {string} str The string to extract the enum from.
 * @returns {object} An object containing the input string ('str')
 *   either in full or without the enum if found and
 *   the enum ('enum') if found.
 */
function extractEnum(str) {
  const result = {str: str};

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
  const result = {str: str};

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
 * Parse a Information Entities (IE) modules DICOM standard XML node.
 *
 * @param {Element} node The content node.
 * @param {Document} partNode The main DOM node.
 * @param {string} expectedCaption The expected node caption.
 * @param {object} fgModules A list of functional group modules.
 * @param {object} macros Cache of macro tables, local to the parent
 *   parsePs33Node call.
 * @returns {Array} The list of ....
 */
function parseModuleAttributesNode(
  node, partNode, expectedCaption, fgModules, macros) {
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
          macros[xmlid] = parseModuleAttributesNode(
            subTable, partNode, undefined, undefined, macros);
        }
        attribute = macros[xmlid];
      }
    } else if (attributeName.includes(includeFG)) {
      // include functional group macro
      includeCase = true;
      attribute = [];
      const keys = Object.keys(fgModules);
      for (const key of keys) {
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
 * Objectify modules properties.
 *
 * @param {Array} properties The module properties.
 * @param {RegExp} [typeRegex] Optional type selection regex.
 * @returns {DicomModuleAttribute} A module attribute object.
 */
function modulePropertiesToObject(properties, typeRegex) {
  // check length (then only use the first element of each item)
  if (properties.length !== 4 && properties.length !== 5) {
    throw new Error('Not the expected module values size: ' +
      properties.length);
  }

  const name = properties[0][0];
  const tag = properties[1][0];
  const type = properties[2][0];

  // Type property:
  // - 1: Required; 1C: Type 1 with condition;
  // - 2: Required, Empty if Unknown; 2C: Type 2 with condition;
  // - 3: Optional
  // https://dicom.nema.org/medical/dicom/current/output/chtml/part05/sect_7.4.html
  if (type !== '1' && type !== '1C' &&
    type !== '2' && type !== '2C' &&
    type !== '3') {
    console.warn('Unexpected module type: ' + type);
  }

  // type filter
  if (typeof typeRegex !== 'undefined' &&
    type.match(typeRegex) === null) {
    return null;
  }

  // description
  let desc = '';
  let enumValues;
  let condition;
  for (let i = 0; i < properties[3].length; ++i) {
    // extract enum
    const extract0 = extractEnum(properties[3][i]);
    if (typeof extract0.enum !== 'undefined') {
      enumValues = extract0.enum;
    }
    if (extract0.str.length !== 0) {
      // extract condition
      const extract1 = extractCondition(extract0.str);
      if (typeof extract1.condition !== 'undefined') {
        condition = extract1.condition;
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

  // include
  let items;
  if (properties.length === 5) {
    items = [];
    const subProperties = properties[4];
    for (const subProps of subProperties) {
      const subModule = modulePropertiesToObject(subProps, typeRegex);
      if (subModule) {
        items.push(subModule);
      }
    }
  }

  return {
    name,
    tag,
    type,
    enum: enumValues,
    condition,
    desc,
    items
  };
}

/**
 * Objectify IOD modules properties.
 *
 * @param {string[][]} properties The IOD module properties.
 * @param {RegExp} [usageRegex] Optional usage selection regex.
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
  const moduleDef = {
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
 * @param {string[]} properties The module properties.
 * @param {RegExp} [typeRegex] Optional type selection regex.
 * @returns {DicomModule[]} A module attribute object.
 */
function modulePropertiesListToObject(properties, typeRegex) {
  const modules = [];
  const keys = Object.keys(properties);
  for (const key of keys) {
    const atts = [];
    for (const mod of properties[key]) {
      const attributes = modulePropertiesToObject(mod, typeRegex);
      if (attributes) {
        atts.push(attributes);
      }
    }
    if (atts.length !== 0) {
      modules.push({
        name: key,
        attributes: atts
      });
    }
  }
  return modules;
}

/**
 * Simplify modules.
 *
 * @param {DicomModule[]} modules The modules.
 * @returns {Record<string, DicomModule>} Simplified modules
 *  indexed by value.
 */
function simplifyModules(modules) {
  /** @type {Record<string, DicomModule>} */
  const res = {};
  for (const module of modules) {
    res[module.name] = module;
  }
  return res;
}
