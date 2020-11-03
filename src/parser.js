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

    var result = null;

    if (label === 'PS3.5') {
      // 32-bit VL VRs
      var vrs = parseVrVl32bits(
        partNode.querySelector('table[label=\'7.1-1\']'),
        'Data Element with Explicit VR');
      result = {
        raw: vrs,
        adapted: vrs,
        asString: vrs.toString()
      };
    } else if (label === 'PS3.6') {
      var tags36 = [];
      // 0002: DICOM File Meta Elements
      tags36 = tags36.concat(parseTagsTableNode(
        partNode.querySelector('table[label=\'7-1\']'),
        'Registry of DICOM File Meta Elements'));
      // 0004: DICOM Directory Structuring Elements
      tags36 = tags36.concat(parseTagsTableNode(
        partNode.querySelector('table[label=\'8-1\']'),
        'Registry of DICOM Directory Structuring Elements'));
      // DICOM Data Elements
      tags36 = tags36.concat(parseTagsTableNode(
        partNode.querySelector('table[label=\'6-1\']'),
        'Registry of DICOM Data Elements'));

      var adaptedTags36 = adaptTagsForDwv(tags36);
      var tagsResults = {
        raw: tags36,
        adapted: adaptedTags36,
        asString: stringifyTags(adaptedTags36)
      };

      // transfer syntax
      var uids = parseUidTableNode(
        partNode.querySelector('table[label=\'A-1\']'),
        'UID Values');
      var adaptedUids = adaptUidsForDwv(uids);
      var uidsResults = {
        raw: uids,
        adapted: adaptedUids,
        asString: stringifyUids(adaptedUids)
      };

      result = [tagsResults, uidsResults];
    } else if (label === 'PS3.7') {
      var tags37 = [];
      // 0000: command
      tags37 = tags37.concat(parseTagsTableNode(
        partNode.querySelector('table[label=\'E.1-1\']'),
        'Command Fields'));
      // 0000: command (retired)
      tags37 = tags37.concat(parseTagsTableNode(
        partNode.querySelector('table[label=\'E.2-1\']'),
        'Retired Command Fields'));

      var adaptedTags37 = adaptTagsForDwv(tags37);
      result = {
        raw: tags37,
        adapted: adaptedTags37,
        asString: stringifyTags(adaptedTags37)
      };
    } else {
      throw new Error('Unknown book label: ' + label);
    }

    return result;
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
 * Adapt tags:
 * - replace '&amp;' in name with '&'
 * - remove comments in name: string after ':'
 * @param {Array} inputUids An array of UIDs.
 * @returns {Array} The adapted UIDs as a new array.
 */
function adaptUidsForDwv(inputUids) {
  // clone input
  var uids = inputUids.slice();

  for (var i = 0; i < uids.length; ++i) {
    var uid = uids[i];
    var name = uid.name;
    // replace '&amp'
    if (name.includes('&amp;')) {
      name = name.replace('&amp;', '&');
      uids[i].name = name;
    }
    // remove comment
    if (name.includes(':')) {
      var pos = name.indexOf(':');
      uids[i].name = name.substr(0, pos);
    }
  }

  return uids;
}

/**
 * Parse a DICOM standard XML tags table node.
 * @param {Node} tableNode A DOM table node.
 * @param {String} expectedCaption The expected table caption.
 * @return {Array} The DICOM tags objects.
 */
function parseTagsTableNode(tableNode, expectedCaption) {
  var values = parseTableNode(tableNode, expectedCaption);
  var tags = [];
  for (var i = 0; i < values.length; ++i) {
    tags.push(tagPropertiesToObject(values[i]));
  }
  return tags;
}

/**
 * Parse a DICOM standard XML UIDs table node.
 * @param {Node} tableNode The content node.
 * @param {String} expectedCaption The expected node caption.
 * @returns {Array} The list of transfer syntax UIDs.
 */
function parseUidTableNode(tableNode, expectedCaption) {
  var values = parseTableNode(tableNode, expectedCaption);
  var uids = [];
  var uid = null;
  for (var i = 0; i < values.length; ++i) {
    uid = uidPropertiesToObject(values[i]);
    if (uid) {
      uids.push(uid);
    }
  }
  return uids;
}

/**
 * Parse a DICOM standard XML table node.
 * @param {Node} tableNode A DOM table node.
 * @param {String} expectedCaption The expected table caption.
 * @return {Array} The objects property values.
 */
function parseTableNode(tableNode, expectedCaption) {
  // check node
  if (!tableNode) {
    throw new Error('No table node.');
  }
  // check caption
  checkNodeCaption(tableNode, expectedCaption);
  // parse node rows
  var values = [];
  tableNode.querySelectorAll('tbody > tr').forEach(
    function (node) {
      values.push(parseTrNode(node));
    }
  );
  return values;
}

/**
 * Check a node caption.
 * @param {Node} node A DOM node.
 * @param {String} expectedCaption The expected node caption.
 * @param {Bool} isEqualCheck Bool to perform equal or include
 *   caption text check.
 */
function checkNodeCaption(node, expectedCaption, isEqualCheck) {
  if (typeof isEqualCheck === 'undefined') {
    isEqualCheck = true;
  }
  var captions = node.getElementsByTagName('caption');
  if (!captions) {
    throw new Error('No node caption.');
  }
  if (captions.length === 0) {
    throw new Error('Empty node caption.');
  }
  var text = captions[0].innerHTML;
  if (isEqualCheck) {
    if (text !== expectedCaption) {
      throw new Error(
        'The node caption is not the expected one: ' +
        expectedCaption + ' != ' + text);
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
 * @param {Node} trNode A DOM row node.
 * @return {Array} The row object properties.
 */
function parseTrNode(trNode) {
  // table cell values
  var properties = [];
  trNode.querySelectorAll('td').forEach(function (node) {
    properties.push(parseTdNode(node));
  });
  // return
  return properties;
}

/**
 * Parse tag values as array and return a tag object.
 * @param {Array} values A tag row array of values (length=6).
 * @return {Object} A tag object: {group, element, keyword, vr, vm}.
 */
function tagPropertiesToObject(values) {
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
 * Parse UID values as array and return a UID object.
 * @param {Array} values A UID row array of values (length=6).
 * @return {Object} A tag object: {group, element, keyword, vr, vm}.
 */
function uidPropertiesToObject(values) {
  if (values.length !== 4) {
    throw new Error('Not the expected UID values size: ' + values.length);
  }
  var uid = null;
  // check UID type
  if (values[2] === 'Transfer Syntax') {
    uid = {
      name: values[1],
      value: values[0]
    };
  }
  return uid;
}

/**
 * Parse a DICOM standard XML table row cell node.
 * @param {Node} tdNode A DOM cell node.
 * @return {string} The cell property value.
 *
 * Examples:
 *
 * <para>(0004,1410)</para>
 *
 * OR
 *
 * <para>
 *   <emphasis role="italic">(0004,1600)</emphasis>
 * </para>
 */
function parseTdNode(tdNode) {
  var property;
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
      property = emphasis[0].innerHTML;
    } else {
      property = para.childNodes[0].nodeValue;
    }
    property = cleanString(property);
  }
  // return
  return property;
}

/**
 * Parse a VR 32bit VL DICOM standard XML node.
 * @param {Node} node The content node.
 * @param {String} expectedCaptionRoot The expected node caption root.
 * @returns {Array} The list of 32bit VRs.
 */
function parseVrVl32bits(node, expectedCaptionRoot) {
  // check node
  if (!node) {
    throw new Error('No VrVl32bits node.');
  }
  // check caption
  checkNodeCaption(node, expectedCaptionRoot, false);
  // expecting something like:
  // 'Data Element with Explicit VR of OB, OW, OF, OD, SQ, UT or UN'
  var regex = /(?:\s)([A-Z]{2})(?:,|\sor|$)/g;
  var caption = node.getElementsByTagName('caption');
  var text = caption[0].innerHTML;
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

/**
 * Stringify a UID array.
 * @param {Array} uids The UID array.
 * @returns {String} A stringified version of the input array.
 */
function stringifyUids(uids) {
  // check uids
  if (!uids) {
    throw new Error('No uids.');
  }
  if (uids.length === 0) {
    throw new Error('Empty uids.');
  }

  // tabulation
  var tab = '  ';
  var quote = '\'';
  // result text
  var text = '{\n';

  for (var i = 0; i < uids.length; ++i) {
    var uid = uids[i];
    // uid
    text += tab +
      quote + uid.value + quote + ': ' +
      quote + uid.name + quote + ',\n';
  }

  // last line
  text += '\n}\n';

  return text;
}
