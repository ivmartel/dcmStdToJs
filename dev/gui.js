import {DicomXMLParser} from '../src/parser.js';
import * as nema from '../src/nema.js';

/**
 * GUI classe.
 */
export class Gui {
  /**
   * Setup the gui: bind parse button.
   */
  setup() {
    document.getElementById('parseFileButton').addEventListener(
      'click', onParseFileButtonClick);
    document.getElementById('fileupload').addEventListener(
      'change', onFileuploadChange);

    document.getElementById('parseTagsButton').addEventListener(
      'click', onParseTagsButtonClick);
    document.getElementById('parseUidsButton').addEventListener(
      'click', onParseUidsButtonClick);
    document.getElementById('parseVrsButton').addEventListener(
      'click', onParseVrsButtonClick);
    document.getElementById('parseModulesButton').addEventListener(
      'click', onParseModulesButtonClick);
  }

  /**
   * DOMContentLoaded handler: update the version select.
   */
  onDOMContentLoaded() {
    updateStandardSelect();
  }
}

/**
 * Set the progress of the progressbar.
 *
 * @param {Event} event A progress event.
 */
function setProgress(event) {
  const progressBar = document.getElementById('progressBar');
  if (event.lengthComputable) {
    progressBar.max = event.total;
    progressBar.value = event.loaded;
  }
}

/**
 * Handle file upload change event.
 *
 * @param {Event} event The file upload change event.
 */
function onFileuploadChange(event) {
  // enable / disable parse button if files were selected
  const parseFileButton = document.getElementById('parseFileButton');
  if (event.target.files.length !== 0) {
    parseFileButton.disabled = false;
  } else {
    parseFileButton.disabled = true;
  }
}

function resetUI() {
  // reset progress
  setProgress({loaded: 0, total: 100, lengthComputable: true});
  // clear output zone
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';
}

function getDicomVersion() {
  const dicomVersionsSelect = document.getElementById('dicomVersions');
  return dicomVersionsSelect.options[
    dicomVersionsSelect.selectedIndex
  ].value;
}

/**
 * Handle parse file button click event.
 *
 * @param {Event} event The parse button click event.
 */
function onParseFileButtonClick(event) {
  const button = event.target;
  // disable button
  button.disabled = true;
  // reset UI
  resetUI();

  // parse file if provided
  const fileInputElement = document.getElementById('fileupload');
  if (fileInputElement.files.length === 1) {
    const file = fileInputElement.files[0];
    const reader = new FileReader();
    reader.onload = function (event) {
      // enable button
      button.disabled = false;
      // show tags
      const domParser = new DOMParser();
      const doc = domParser.parseFromString(
        event.target.result, 'application/xml');
      try {
        const parser = new DicomXMLParser();
        showResult(parser.parseNode(doc, file.name));
      } catch (error) {
        showError(error);
      }
      // clear
      fileInputElement.value = '';
    };
    reader.onprogress = setProgress;
    reader.onloadend = setProgress;
    reader.onerror = function () {
      showError('ERROR while loading data, see log for details...');
    };
    reader.readAsText(file);
  }
}

/**
 * Handle parse tags url button click event.
 *
 * @param {Event} event The parse button click event.
 */
function onParseTagsButtonClick(event) {
  const parser = new DicomXMLParser();
  const parseFunc = parser.parseTags;
  onParseUrlsButtonClick(event, parseFunc, ['06', '07']);
}

/**
 * Handle parse UIDs url button click event.
 *
 * @param {Event} event The parse button click event.
 */
function onParseUidsButtonClick(event) {
  const parser = new DicomXMLParser();
  const parseFunc = parser.parseUids;
  onParseUrlsButtonClick(event, parseFunc, ['06']);
}

/**
 * Handle parse VRs url button click event.
 *
 * @param {Event} event The parse button click event.
 */
function onParseVrsButtonClick(event) {
  const parser = new DicomXMLParser();
  const parseFunc = parser.parseVrs;
  onParseUrlsButtonClick(event, parseFunc, ['05']);
}

/**
 * Handle parse Modules url button click event.
 *
 * @param {Event} event The parse button click event.
 */
function onParseModulesButtonClick(event) {
  const parser = new DicomXMLParser();
  const parseFunc = parser.parseModules;
  onParseUrlsButtonClick(event, parseFunc, ['03']);
}

/**
 * Handle parse tags url button click event.
 *
 * @param {Event} event The parse button click event.
 */
function onParseUrlsButtonClick(event, parseFunc, partNumbers) {
  const button = event.target;
  // disable button
  button.disabled = true;
  // reset UI
  resetUI();

  // use selected version or default
  const selectedVersion = getDicomVersion();

  const urls = [];
  for (const number of partNumbers) {
    urls.push(nema.getDicomPartLinks(number)[selectedVersion].xml);
  }

  const onload = function (responses) {
    // enable button
    button.disabled = false;
    // show tags
    try {
      showResult(parseFunc(responses, urls[0]));
    } catch (error) {
      showError(error);
    }
  };

  sendRequests(urls, onload);
}

/**
 * Send URL requests-
 *
 * @param {string[]} urls Url list.
 * @param {Function} onload Onload callback.
 */
function sendRequests(urls, onload) {
  const responses = [];
  for (const url of urls) {
    const request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'document';
    request.overrideMimeType('text/xml'); // force xml
    request.onload = function (event) {
      responses.push(event.target.response);
      if (responses.length === urls.length) {
        onload(responses);
      }
    };
    request.onprogress = setProgress;
    request.onloadend = setProgress;
    request.onerror = function () {
      showError('ERROR while retrieving data, see log for details...');
    };
    request.send();
  }
}

/**
 * Format a parse result into a html element and append it to the 'output' div.
 *
 * @param {Array} result A parse result object array.
 */
function showResult(result) {
  // append to page as text area
  for (let i = 0; i < result.length; ++i) {
    appendResult('result-' + i, result[i]);
  }
}

/**
 * Show an error result.
 *
 * @param {string|Event} error The error to display.
 */
function showError(error) {
  console.error(error);
  let message = error;
  if (typeof error.message !== 'undefined') {
    message = error.message;
  }
  appendResult('error', message);
}

/**
 * Make a name a file name.
 *
 * @param {string} name The name to change.
 * @returns {string} The file name.
 */
function toFileName(name) {
  name = name.replaceAll(' ', '_');
  return name.toLowerCase();
}
/**
 * Append a text area to the ouput div.
 *
 * @param {string} name The name of text area.
 * @param {object} content The result content.
 */
function appendResult(name, content) {
  const div = document.getElementById('output');
  let contentString;

  if (typeof content.name !== 'undefined') {
    const para = document.createElement('p');
    let numberOfItems;
    if (Array.isArray(content.raw)) {
      numberOfItems = content.raw.length;
    } else {
      numberOfItems = Object.keys(content.raw).length;
    }
    para.appendChild(document.createTextNode(
      content.name +
      ' (' + content.origin +
      ', ' + numberOfItems + ' items) '
    ));

    const link = document.createElement('a');
    link.download = toFileName(content.name) + '.json';
    const blob = new Blob([content.data], {type: 'text/plain'});
    link.href = window.URL.createObjectURL(blob);
    link.appendChild(document.createTextNode('download'));

    para.appendChild(link);
    div.appendChild(para);

    contentString = content.data;
  } else {
    contentString = content;
  }

  const area = document.createElement('textarea');
  area.id = name;
  area.appendChild(document.createTextNode(contentString));
  area.spellcheck = false;
  if (name.includes('error')) {
    area.className = 'error';
  } else {
    area.rows = 20;
  }

  div.appendChild(area);
}

/**
 * Update standard select with available standard versions.
 */
function updateStandardSelect() {
  const versionSelect = document.getElementById('dicomVersions');

  // place holder option
  let versionOption = document.createElement('option');
  versionOption.disabled = true;
  versionOption.selected = true;
  versionOption.text = 'Select a version';
  versionOption.value = '';
  versionSelect.add(versionOption);
  // version options
  const versions = nema.getDicomVersions();
  for (let i = 0; i < versions.length; ++i) {
    versionOption = document.createElement('option');
    versionOption.text = versions[i];
    versionOption.value = versions[i];
    versionSelect.add(versionOption);
  }

  // update associated links on select change
  versionSelect.onchange = function (/*event*/) {
    const parseTagsButton = document.getElementById('parseTagsButton');
    parseTagsButton.disabled = false;
    const parseUidsButton = document.getElementById('parseUidsButton');
    parseUidsButton.disabled = false;
    const parseVrsButton = document.getElementById('parseVrsButton');
    parseVrsButton.disabled = false;
    const parseModulesButton = document.getElementById('parseModulesButton');
    parseModulesButton.disabled = false;
  };
}
