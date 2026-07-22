import {
  getSelector,
  parseTableNode
} from './genericParser.js';

/**
 * @import {DicomParseResult} from './parser.js';
 */

/**
 * DICOM tag class.
 */
export class DicomTag {
  /**
   * @type {string}
   */
  group;
  /**
   * @type {string}
   */
  element;
  /**
   * @type {string}
   */
  keyword;
  /**
   * @type {string}
   */
  vr;
  /**
   * @type {string}
   */
  vm;
}

/**
 * Parse a PS3.6 node: Data Dictionary.
 * See: {@link https://dicom.nema.org/medical/dicom/current/output/chtml/part06/PS3.6.html}.
 *
 * @param {Document} partNode The main DOM node.
 * @param {string} [origin] Optional node origin.
 * @returns {DicomParseResult[]} The parse results.
 */
export function parsePs36TagsNode(partNode, origin) {
  /** @type {DicomTag[]} */
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
    data: JSON.stringify(simplifyTags(adaptTagsForDwv(tags36)), null, '  ')
  };

  return [tagsResults,];
}

/**
 * Parse a PS3.7 node: Message Exchange.
 * See: {@link https://dicom.nema.org/medical/dicom/current/output/chtml/part07/PS3.7.html}.
 *
 * @param {Document} partNode The main DOM node.
 * @param {string} [origin] Optional node origin.
 * @returns {DicomParseResult[]} The parse result.
 */
export function parsePs37Node(partNode, origin) {
  /** @type {DicomTag[]} */
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

  return [{
    name: 'DICOM tags group 0000',
    origin: origin,
    raw: tags37,
    data: JSON.stringify(simplifyTags(adaptTagsForDwv(tags37)), null, '  ')
  }];
}

/**
 * Parse a DICOM standard XML tags table node.
 *
 * @param {Element} tableNode A DOM table node.
 * @param {Document} partNode The main DOM node.
 * @param {string} expectedCaption The expected node caption.
 * @returns {DicomTag[]} The list of DICOM tags objects.
 */
function parseTagsTableNode(tableNode, partNode, expectedCaption) {
  const values = parseTableNode(tableNode, partNode, expectedCaption);
  const tags = [];
  for (const value of values) {
    const tag = tagPropertiesToObject(value);
    if (tag) {
      tags.push(tag);
    }
  }
  return tags;
}

/**
 * Parse tag values as array and return a tag object.
 *
 * @param {string[][]} properties A tag row array of properties (length=6).
 * @returns {DicomTag} The tag object.
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
 * Get a compare function for a specific string property.
 *
 * @param {string} property The string property to sort by.
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
 * @param {string[]} properties The list of string properties to sort by.
 * @returns {function(object, object): number} A compare function.
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
 * Adapt tags:
 *   - replace 'x' in groups and elements,
 *   - add GenericGroupLength to groups,
 *   - replace non single VRs.
 *
 * @param {DicomTag[]} inputTags An array of tags.
 * @returns {DicomTag[]} The adapted tags as a new array.
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
    str = str.replace(/xxxx/g, '0004');
    str = str.replace(/xxx/g, '001');
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
 * Simplify tags.
 *
 * @param {DicomTag[]} tags The tags.
 * @returns {Record<string, Record<string, string[]>>} Simplified tags
 *   indexed by group then element.
 */
function simplifyTags(tags) {
  /** @type {Record<string, Record<string, string[]>>} */
  const res = {};
  for (const tag of tags) {
    if (typeof res[tag.group] === 'undefined') {
      res[tag.group] = {};
    }
    res[tag.group][tag.element] = [
      tag.vr, tag.vm, tag.keyword
    ];
  }
  return res;
}