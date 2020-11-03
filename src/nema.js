// DICOM versions object
// (only those published with this repo since NEMA does not do CORS...)
const dicomVersions = {
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
export function getDicomVersions() {
  const keys = Object.keys(dicomVersions);
  keys.sort(compare);
  // create version strings
  const versions = [];
  for (let i = 0; i < keys.length; ++i) {
    const majorVersion = keys[i];
    const minorVersions = dicomVersions[majorVersion];
    for (let j = 0; j < minorVersions.length; ++j) {
      versions.push(majorVersion + minorVersions[j]);
    }
  }
  // add current shortcut
  // versions.splice(0, 0, 'current');
  // return
  return versions;
}

// reverse sort keys
function compare(a, b) {
  return parseInt(b, 10) - parseInt(a, 10);
}

/**
 * Get a list of DICOM versions associated to their resrouce link
 * @returns An object in the form of:
 * {
 *   2020a: {xml: %xmlLink%, html: %htmlLink%},
 *   ...
 * }
 */
export function getDicomPart06Links() {
  const partNumber = '06';
  const versions = getDicomVersions();
  const links = {};
  for (let i = 0; i < versions.length; ++i) {
    storeLink(links, versions[i], partNumber);
  }
  // add current
  storeLink(links, 'current', partNumber);
  // return
  return links;
}

function storeLink(storage, version, pNumber) {
  storage[version] = {
    'xml': getNemaLink(version, 'xml', pNumber),
    'html': getNemaLink(version, 'html', pNumber),
  };
}

/**
 * Get the nema link to the standard.
 * @param {String} version The standard version.
 * @param {String} format The format of the retrieved file: 'xml' or 'html'
 * @param {String} partNumber The standard part number as a string.
 * @returns The full link to the desired file.
 */
function getNemaLink(version, format, partNumber) {
  // no https...
  const nemaRoot = 'http://dicom.nema.org/medical/dicom/';
  const partFileName = 'part' + partNumber;
  let link = nemaRoot + version + '/';
  if (format === 'xml') {
    // not published with CORS...
    //link += 'source/docbook/' +
    //  partFileName + '/' + partFileName + '.xml';
    const githubRoot = 'https://raw.githubusercontent.com/ivmartel/dcmStdToJs/master/resources/standard/';
    link = githubRoot + version + '-' + partFileName + '.xml';
  } else if (format === 'html') {
    link += 'output/html/' +
      partFileName + '.html';
  }
  return link;
}
