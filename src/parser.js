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
    var tableCallback = function (node) {
      tags = tags.concat(parseTableNode(node));
    };

    // 0002: DICOM File Meta Elements
    part06Node.querySelectorAll('table[label=\'7-1\']').forEach(tableCallback);
    // 0004: DICOM Directory Structuring Elements
    part06Node.querySelectorAll('table[label=\'8-1\']').forEach(tableCallback);
    // 0008: DICOM Data Elements
    part06Node.querySelectorAll('table[label=\'6-1\']').forEach(tableCallback);

    return tags;
  }
}

/**
 * Parse a part06 XML table node.
 * @param {Node} tableNode A DOM node.
 * @return {Array} The cresponding list of tags.
 */
function parseTableNode(tableNode) {
  var tags = [];
  tableNode.querySelectorAll('tr').forEach(function (node) {
    var tag = parseTrNode(node);
    if (typeof tag !== 'undefined') {
      tags.push(tag);
    }
  });
  // return
  return tags;
}

/**
 * Parse a part06 XML table row node.
 * @param {Node} trNode A DOM node.
 * @return {Object} The cresponding tag.
 */
function parseTrNode(trNode) {
// table cell values
  var values = [];
  trNode.querySelectorAll('td').forEach(function (node) {
    values.push(parseTdNode(node));
  });
  // create tag from values
  var tag;
  if (values.length !== 0) {
    tag = parseTagRow(values)
  }
  // return
  return tag;
}

/**
 * Parse a tag row and return a tag object.
 * @param {Array} row A tag row (length=6).
 * @return {Object} A tag object: {group, element, keyword, vr, vm}.
 */
function parseTagRow(row) {
  if (row.length !== 6) {
    throw new Error('Not the expected tag row size.');
  }
  // split (group,element)
  var geSplit = row[0].split(',');
  // not replacing 'x' (elemNum.replace(/x/g, '0'))
  var group = '0x' + geSplit[0].substr(1, 4).toString();
  var element = '0x' + geSplit[1].substr(0, 4).toString();
  // vr
  var vr = row[3];
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
    keyword: typeof row[2] === 'undefined' ? '' : row[2],
    vr: vr,
    vm: typeof row[4] === 'undefined' ? '' : row[4]
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
function parseTdNode(tdNode) {
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
