// namespace
var dstj = dstj || {};
dstj.nema = dstj.nema || {};

dstj.nema.dicomVersions = {
  '2014': ['a'], // ['a', 'b', 'c'],
  '2015': ['a'], // ['a', 'b', 'c'],
  '2016': ['a'], // ['a', 'b', 'c', 'd', 'e'],
  '2017': ['a'], // ['a', 'b', 'c', 'd', 'e'],
  '2018': ['a'], // ['a', 'b', 'c', 'd', 'e'],
  '2019': ['a'], // ['a', 'b', 'c', 'd', 'e'],
  //'2020': ['a', 'b', 'c']
};

/**
 * Get the list of DICOM standard versions.
 * @returns An array of versions, ordered from most recent to older
 *   and with a 'current' first element.
 */
dstj.nema.getDicomVersions = function () {
  var keys = Object.keys(dstj.nema.dicomVersions);
  // reverse sort keys
  function compare(a, b) {
    return parseInt(b, 10) - parseInt(a, 10);
  }
  keys.sort(compare);
  // create version strings
  var versions = [];
  for (var i = 0; i < keys.length; ++i) {
    var majorVersion = keys[i];
    var minorVersions = dstj.nema.dicomVersions[majorVersion];
    for (var j = 0; j < minorVersions.length; ++j) {
      versions.push(majorVersion + minorVersions[j]);
    }
  }
  // add current shortcut
  // versions.splice(0, 0, 'current');
  // return
  return versions;
}

/**
 * Get the nema link to the standard.
 * @param {String} version The standard version.
 * @param {String} format The format of the retrieved file: 'xml' or 'html'
 * @param {String} partNumber The standard part number as a string.
 * @returns The full link to the desired file.
 */
dstj.nema.getNemaLink = function (version, format, partNumber) {
  // no https...
  var nemaRoot = 'http://dicom.nema.org/medical/dicom/';
  var partFileName = 'part' + partNumber;
  var link = nemaRoot + version + '/';
  if (format === 'xml') {
    // not published with CORS...
    //link += 'source/docbook/' +
    //  partFileName + '/' + partFileName + '.xml';
    var githubRoot = 'https://raw.githubusercontent.com/ivmartel/dcmStdToJs/master/resources/standard/';
    link = githubRoot + version + '-' + partFileName + '.xml';
  } else if (format === 'html') {
    link += 'output/html/' +
      partFileName + '.html';
  }
  return link;
}

/**
 * Get a list of DICOM versions associated to their resrouce link
 * @returns An object in the form of:
 * {
 *   2020a: {xml: %xmlLink%, html: %htmlLink%},
 *   ...
 * }
 */
dstj.nema.getDicomPart06Links = function () {
  function storeLink(storage, version, pNumber) {
    storage[version] = {
      'xml': dstj.nema.getNemaLink(version, 'xml', pNumber),
      'html': dstj.nema.getNemaLink(version, 'html', pNumber),
    };
  }

  var partNumber = '06';
  var versions = dstj.nema.getDicomVersions();
  var links = {};
  for (var i = 0; i < versions.length; ++i) {
    storeLink(links, versions[i], partNumber);
  }
  // add current
  storeLink(links, 'current', partNumber);
  // return
  return links;
}
