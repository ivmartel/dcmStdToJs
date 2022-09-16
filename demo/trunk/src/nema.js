// DICOM versions object
// (only those published with this repo since NEMA does not do CORS...)
const dicomVersions = {
  '2016': ['a'],
  '2018': ['a'],
  '2020': ['a'],
  '2022': ['a'],
};

const dicomParts = ['03', '05', '06', '07'];

/**
 * Get the list of DICOM standard parts.
 * @returns An array of parts
 */
export function getDicomParts() {
  return dicomParts;
}

/**
 * Get the list of DICOM standard versions.
 * @returns An array of versions, ordered from most recent to older.
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
export function getDicomPartLinks(partNumber) {
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
    'xml': getXmlLink(version, pNumber),
    'html': getHtmlLink(version, pNumber),
  };
}

/**
 * Get the xml link to the standard.
 * Links go to github since nema does not publish standard with CORS
 *
 * @param {String} version The standard version.
 * @param {String} partNumber The standard part number as a string.
 * @returns The full link to the desired file.
 */
function getXmlLink(version, partNumber) {
  const githubRoot = 'https://raw.githubusercontent.com/ivmartel/dcmStdToJs/master/resources/standard';
  const partFileName = 'part' + partNumber;
  return githubRoot + '/' + version + '/' + partFileName + '.xml';
}

/**
 * Get the html link to the standard.
 *
 * @param {String} version The standard version.
 * @param {String} partNumber The standard part number as a string.
 * @returns The full link to the desired html.
 */
function getHtmlLink(version, partNumber) {
  const nemaRoot = 'http://dicom.nema.org/medical/dicom';
  const partFileName = 'part' + partNumber;
  return nemaRoot + '/' + version + '/output/html/' + partFileName + '.html';
}
