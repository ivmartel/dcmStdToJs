/**
 * DICOM part06 (xml) parser.
 */
export class Part06Parser {

  /**
   * Parse a DICOM part06 xml.
   * @param {Node} part06Node A DOM node.
   * @return {Array} The corresponding tags array.
   */
  parseNode(part06Node) {
    var tags = [];
    var callback = function (node) {
      tags.push(parseTagTrNode(node));
    };

    // 0002: DICOM File Meta Elements
    part06Node.querySelectorAll(
      'table[label=\'7-1\'] > tbody > tr').forEach(callback);
    // 0004: DICOM Directory Structuring Elements
    part06Node.querySelectorAll(
      'table[label=\'8-1\'] > tbody > tr').forEach(callback);
    // 0008: DICOM Data Elements
    part06Node.querySelectorAll(
      'table[label=\'6-1\'] > tbody > tr').forEach(callback);

    return tags;
  }
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
  if (values.length !== 6) {
    throw new Error('Not the expected tag values size.');
  }
  // split (group,element)
  var geSplit = values[0].split(',');
  // not replacing 'x' (elemNum.replace(/x/g, '0'))
  var group = '0x' + geSplit[0].substr(1, 4).toString();
  var element = '0x' + geSplit[1].substr(0, 4).toString();
  // vr
  var vr = values[3];
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
  // return
  return {
    group: group,
    element: element,
    keyword: typeof values[2] === 'undefined' ? '' : values[2],
    vr: vr,
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
  if (paras.length !== 1) {
    throw new Error('Not the expected \'para\' elements length.');
  }
  var para = paras[0];
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
