/**
 * DICOM xml parser.
 */
export class DicomXMLParser {

  /**
   * Parse a DICOM standard xml node.
   * @param {Node} partNode A DOM node.
   * @return {Object} An object containing:
   * - raw: the raw tags
   * - adapted: the adapted tags for dwv
   * - asString: the adapted tags as string
   */
  parseNode(partNode) {
    // get book node
    var book = partNode.querySelector('book');
    if (!book) {
      throw new Error('No book node.');
    }
    // get book label
    var label = book.getAttribute('label');
    if (!label) {
      throw new Error('No book label.');
    }

    var raw = null;
    var adapted = null;
    var asString = null;
    var tags = [];

    if (label === 'PS3.5') {
      // 32-bit VL VRs
      raw = parseVrVl32bits(
        partNode.querySelector('table[label=\'7.1-1\']'),
        'Data Element with Explicit VR');
      adapted = raw;
      asString = raw.toString();
    } else if (label === 'PS3.6') {
      // 0002: DICOM File Meta Elements
      tags = tags.concat(parseTagsTableNode(
        partNode.querySelector('table[label=\'7-1\']'),
        'Registry of DICOM File Meta Elements'));
      // 0004: DICOM Directory Structuring Elements
      tags = tags.concat(parseTagsTableNode(
        partNode.querySelector('table[label=\'8-1\']'),
        'Registry of DICOM Directory Structuring Elements'));
      // DICOM Data Elements
      tags = tags.concat(parseTagsTableNode(
        partNode.querySelector('table[label=\'6-1\']'),
        'Registry of DICOM Data Elements'));

      raw = tags;
      adapted = adaptTagsForDwv(raw);
      asString = stringifyTags(adapted);
    } else if (label === 'PS3.7') {
      // 0000: command
      tags = tags.concat(parseTagsTableNode(
        partNode.querySelector('table[label=\'E.1-1\']'),
        'Command Fields'));
      // 0000: command (retired)
      tags = tags.concat(parseTagsTableNode(
        partNode.querySelector('table[label=\'E.2-1\']'),
        'Retired Command Fields'));

      raw = tags;
      adapted = adaptTagsForDwv(raw);
      asString = stringifyTags(adapted);
    } else {
      throw new Error('Unknown book label: ' + label);
    }

    return {raw, adapted, asString};
  }
}

/**
 * Get a compare function for a specific object property.
 * @param {String} property The object property to sort by.
 * @returns A compare function.
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
 * @param {Array} properties The list of object properties to sort by.
 * @returns A compare function.
 */
function getMultiCompare(properties) {
  return function (a, b) {
    var res = null;
    for (var i = 0; i < properties.length; ++i) {
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
 * - replace 'x' in groups and elements
 * - add GenericGroupLength to groups
 * - replace non single VRs
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

  // replace 'x's in groups and elements
  function replaceXs(str) {
    str = str.replace(/xxxxx/g, 'x0004');
    str = str.replace(/xxxx/g, 'x001');
    str = str.replace(/xx/g, '00');
    return str;
  }

  // clone input
  var tags = inputTags.slice();

  // list groups
  var groups = [];
  for (var t = 0; t < tags.length; ++t) {
    // replace 'x's
    tags[t].group = replaceXs(tags[t].group);
    tags[t].element = replaceXs(tags[t].element);
    // list groups
    var grp = tags[t].group;
    if (!groups.includes(grp)) {
      groups.push(grp);
    }
  }

  // add GenericGroupLength to groups
  for (var g = 0; g < groups.length; ++g) {
    var group = groups[g];
    if (group !== '0x0000' && group !== '0x0002') {
      tags.push({
        group: group,
        element: '0x0000',
        keyword: 'GenericGroupLength',
        vr: 'UL',
        vm: '1'
      });
    }
  }

  // sort tags
  tags.sort(getMultiCompare(['group', 'element']));

  // check VRs
  for (var i = 0; i < tags.length; ++i) {
    var vr = tags[i].vr;
    if (typeof vr !== 'undefined') {
      if (vr.substr(0, 8) === 'See Note') {
        // #modif "See Note" -> "NONE"
        vr = 'NONE';
      } else if (vr === 'OB or OW') {
        // #modif "OB or OW" -> "ox"
        vr = 'ox';
      } else if (vr === 'US or SS') {
        // #modif "US or SS" -> "xs"
        vr = 'xs';
      }
    } else {
      vr = '';
    }
    tags[i].vr = vr;
  }

  return tags;
}

/**
 * Parse a DICOM standard XML table node.
 * @param {Node} tableNode A DOM node representing DICOM tags.
 * @param {String} expectedCaption The expected table caption.
 * @return {Object} The cresponding DICOM tags.
 */
function parseTagsTableNode(tableNode, expectedCaption) {
  // check node
  if (!tableNode) {
    throw new Error('No table node.');
  }
  // check caption
  var captions = tableNode.getElementsByTagName('caption');
  if (!captions) {
    throw new Error('No table caption.');
  }
  if (captions.length === 0) {
    throw new Error('Empty table caption.');
  }
  var text = captions[0].innerHTML;
  if (text !== expectedCaption) {
    throw new Error(
      'The table caption is not the expected one: ' +
      expectedCaption + ' != ' + text);
  }
  // parse node rows
  var tags = [];
  tableNode.querySelectorAll('tbody > tr').forEach(
    function (node) {
      tags.push(parseTagTrNode(node));
    }
  );
  return tags;
}

/**
 * Parse a DICOM standard XML table row node.
 * @param {Node} trNode A DOM node representing a DICOM tag.
 * @return {Object} The cresponding DICOM tag.
 */
function parseTagTrNode(trNode) {
  // table cell values
  var values = [];
  trNode.querySelectorAll('td').forEach(function (node) {
    values.push(parseTagTdNode(node));
  });
  // create tag from values
  var tag;
  if (values.length !== 0) {
    tag = parseTagValues(values);
  }
  // return
  return tag;
}

/**
 * Parse tag values as array and return a tag object.
 * @param {Array} values A tag row array of values (length=6).
 * @return {Object} A tag object: {group, element, keyword, vr, vm}.
 */
function parseTagValues(values) {
  if (values.length !== 5 && values.length !== 6) {
    throw new Error('Not the expected tag values size: ' + values.length);
  }
  // split (group,element)
  var geSplit = values[0].split(',');
  var group = '0x' + geSplit[0].substr(1, 4).toString();
  var element = '0x' + geSplit[1].substr(0, 4).toString();
  // return
  return {
    group: group,
    element: element,
    keyword: typeof values[2] === 'undefined' ? '' : values[2],
    vr: typeof values[3] === 'undefined' ? '' : values[3],
    vm: typeof values[4] === 'undefined' ? '' : values[4]
  };
}

/**
 * Parse a DICOM standard XML table row cell node.
 * @param {Node} tdNode A DOM node.
 * @return {string} The tag property value.
 *
 * Examples:
 *
 * <para>(0004,1410)</para>
 *
 * <para>
 *   <emphasis role="italic">(0004,1600)</emphasis>
 * </para>
 */
function parseTagTdNode(tdNode) {
  var value;
  // expect one 'para' eñement
  var paras = tdNode.getElementsByTagName('para');
  if (paras.length === 0) {
    throw new Error('No para in table cell...');
  }
  var para = paras[0];
  if (paras.length !== 1) {
    var label = para.getAttribute('xml:id');
    console.warn(
      'Using first para (label: ' + label + ') of ' +
      paras.length + ' (expected just one...)');
  }
  // parse childs
  if (para.childNodes.length !== 0) {
    // if the para contains an emphasis child, use its content
    var emphasis = para.getElementsByTagName('emphasis');
    if (emphasis.length !== 0) {
      if (emphasis.length !== 1) {
        throw new Error('Not the expected \'emphasis\' elements length.');
      }
      value = emphasis[0].innerHTML;
    } else {
      value = para.childNodes[0].nodeValue;
    }
    value = cleanString(value);
  }
  // return
  return value;
}

/**
 * Parse a VR 32bit VL DICOM standard XML node.
 * @param {Node} node The content node.
 * @param {String} expectedCaptionRoot The expected node caption root.
 * @returns {Array} The list of 32bit VRs.
 */
function parseVrVl32bits(node, expectedCaptionRoot) {
  var caption = node.getElementsByTagName('caption');
  var text = caption[0].innerHTML;
  // check caption root
  if (!text.includes(expectedCaptionRoot)) {
    throw new Error(
      'The provided node does not include the expected caption: ' +
      expectedCaptionRoot + ' != ' + text);
  }
  // expecting something like:
  // 'Data Element with Explicit VR of OB, OW, OF, OD, SQ, UT or UN'
  var regex = /(?:\s)([A-Z]{2})(?:,|\sor|$)/g;
  var matches = text.matchAll(regex);
  var result = [];
  for (var match of matches) {
    result.push(match[1]); // [0] includes non capturing groups
  }
  return result;
}


// trim and get rid of zero-width space
function cleanString(str) {
  return str.trim().replace(/\u200B/g, '');
}

/**
 * Stringify a tags array.
 * @param {Array} tags The tags array.
 * @returns {String} A stringified version of the input array.
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
  var tab = '  ';
  var quote = '\'';
  // result text
  var text = '';

  var group = '';
  for (var i = 0; i < tags.length; ++i) {
    var tag = tags[i];
    var isFirstOfgroup = false;
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
    var tagText = isFirstOfgroup ? '' : ',\n';
    tagText += tab + tab +
      quote + tag.element + quote + ': [' +
      quote + tag.vr + quote + ', ' +
      quote + tag.vm + quote + ', ' +
      quote + tag.keyword + quote + ']';
    text += tagText;
  }

  // last line
  text += '\n' + tab + '}\n';

  return text;
}
