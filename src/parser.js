/**
 * DICOM part06 (xml) parser.
 */
export class Part06Parser {

  /**
   * Parse a DICOM part06 xml.
   * @param {Node} part06Node A DOM node.
   * @return {Array} The corresponding tags array.
   */
  parseNode(partNode) {
    var tags = [];
    var callback = function (node) {
      tags.push(parseTagTrNode(node));
    };

    var label = partNode.querySelector('book').getAttribute('label')
    if (typeof label === 'undefined' || label.length === 0) {
      throw new Error('The provided node does not have a label.');
    }

    if (label === 'PS3.6') {
      // 0002: DICOM File Meta Elements
      partNode.querySelectorAll(
        'table[label=\'7-1\'] > tbody > tr').forEach(callback);
      // 0004: DICOM Directory Structuring Elements
      partNode.querySelectorAll(
        'table[label=\'8-1\'] > tbody > tr').forEach(callback);
      // DICOM Data Elements
      partNode.querySelectorAll(
        'table[label=\'6-1\'] > tbody > tr').forEach(callback);
    } else if (label === 'PS3.7') {
      // 0000: command
      partNode.querySelectorAll(
        'table[label=\'E.1-1\'] > tbody > tr').forEach(callback);
      // 0000: command (retired)
      partNode.querySelectorAll(
        'table[label=\'E.2-1\'] > tbody > tr').forEach(callback);
    } else {
      throw new Error('Don\'t know how to parse thiss label: ' + label);
    }

    return modifyTags(tags);
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
 * Get a mulit compare function for a list of object properties.
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
 * Modify tags:
 * - replace 'x' in groups and elements
 * - add GenericGroupLength to groups
 * - replace non single VRs
 */
function modifyTags(tags) {
  // replace 'x's in groups and elements
  function replaceXs(str) {
    str = str.replace(/xxxxx/g, 'x0004');
    str = str.replace(/xxxx/g, 'x001');
    str = str.replace(/xx/g, '00');
    return str;
  }

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
 * Parse a part06 XML table row node.
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
    tag = parseTagValues(values)
  }
  // return
  return tag;
}

/**
 * Parse a tag row and return a tag object.
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
 * Parse a part06 XML table row cell node.
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
  var para = paras[0];
  if (paras.length !== 1) {
    var label = para.getAttribute('xml:id');
    console.warn(
      'Using first \'para\' (label: ' + label + ') of ' +
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

// trim and get rid of zero-width space
function cleanString(str) {
  return str.trim().replace(/\u200B/g, '');
}
