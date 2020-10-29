import {Part06Parser} from './parser.js';
import * as nema from './nema.js';

/**
 * GUI classe.
 */
export class Gui {
  /**
   * Setup the gui: bind parse button.
   */
  setup() {
    document.getElementById('parseButton').addEventListener(
      'click', onParseButton);
  }

  /**
   * DOMContentLoaded handler: update the version select.
   */
  onDOMContentLoaded() {
    updateVersionSelect();
  }
}

/**
 * Set the progress of the progressbar.
 * @param {Event} event A progress event.
 */
function setProgress(event) {
  var progressBar = document.getElementById('progressBar');
  if (event.lengthComputable) {
    progressBar.max = event.total;
    progressBar.value = event.loaded;
  }
}

/**
 * Load selected file or link.
 * @param {Event} event The parse button click event.
 */
function onParseButton(event) {
  var button = event.target;

  // reset progress
  setProgress({loaded: 0, total: 100, lengthComputable: true});

  // disable button
  button.disabled = true;

  // clear output zone
  var outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  var parser = new Part06Parser();

  // parse file if provided, parse link otherwise
  var fileInputElement = document.getElementById('fileupload');
  if (fileInputElement.files.length === 1) {
    var file = fileInputElement.files[0];
    var reader = new FileReader();
    reader.onload = function (event) {
      // enable button
      button.disabled = false;
      // show tags
      var domParser = new DOMParser();
      var doc = domParser.parseFromString(
        event.target.result, 'application/xml');
      showTags(parser.parseNode(doc));
    };
    reader.onprogress = setProgress;
    reader.onloadend = setProgress;
    reader.onerror = function () {
      outputDiv.innerHTML =
        'ERROR while loading data, see log for details...';
    }
    reader.readAsText(file);
  } else {
    // use selected version or default
    var dicomVersionsSelect = document.getElementById('dicomVersions');
    var selectedVersion = dicomVersionsSelect.options[
      dicomVersionsSelect.selectedIndex
    ].value;
    var defaultVersion = '2019a';
    if (selectedVersion.length === 0) {
      selectedVersion = defaultVersion;
    }

    var url = nema.getDicomPart06Links()[selectedVersion].xml;
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'document';
    request.overrideMimeType('text/xml'); // force xml
    request.onload = function (event) {
      // enable button
      button.disabled = false;
      // show tags
      showTags(parser.parseNode(event.target.response));
    };
    request.onprogress = setProgress;
    request.onloadend = setProgress;
    request.onerror = function () {
      outputDiv.innerHTML =
        'ERROR while retrieving data, see log for details...';
    }
    request.send();
  }
}

/**
 * Format tags into a html element and append it to the 'output' div.
 * @param {Array} tags An array of DICOM tags.
 */
function showTags(tags) {
  // tabulation
  var tab = '  ';
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
      text += tab + '\'' + tag.group + '\': {\n';
    }

    // tag
    var tagText = isFirstOfgroup ? '' : ',\n';
    tagText += tab + tab +
      '\'' + tag.element + '\': [\'' + tag.vr +
      '\', \'' + tag.vm +
      '\', \'' + tag.keyword + '\']';
    text += tagText;
  }

  // last line
  text += '\n' + tab + '}\n';

  // append to page
  var area = document.createElement('textarea');
  area.appendChild(document.createTextNode(text));
  area.style = 'width: 99%; margin-top: 10px;';
  area.rows = 35;
  area.spellcheck = false;

  var div = document.getElementById('output');
  div.appendChild(area);
}

/**
 * Update version select with available standard versions
 */
function updateVersionSelect() {
  var versionSelect = document.getElementById('dicomVersions');

  // place holder option
  var option = document.createElement('option');
  option.disabled = true;
  option.selected = true;
  option.text = 'Select a version';
  option.value = '';
  versionSelect.add(option);
  // version options
  var versions = nema.getDicomVersions();
  for (var i = 0; i < versions.length; ++i) {
    option = document.createElement('option');
    option.text = versions[i];
    option.value = versions[i];
    versionSelect.add(option);
  }

  // update associated links on select change
  versionSelect.onchange = function (event) {
    updateVersionLinks(event.target.value);
  }
}

/**
 *
 */
function updateVersionLinks(version) {
  var links = nema.getDicomPart06Links()[version];
  // xml standard link
  var xmlLink = document.createElement('a');
  xmlLink.href = links.xml;
  xmlLink.appendChild(document.createTextNode('xml'));
  // html standard link
  var htmlLink = document.createElement('a');
  htmlLink.href = links.html;
  htmlLink.appendChild(document.createTextNode('html'));

  var versionLinks = document.getElementById('versionLinks');
  // clear
  versionLinks.innerHTML = '';
  // add new links
  versionLinks.appendChild(document.createTextNode('(dict (part06): '));
  versionLinks.append(xmlLink);
  versionLinks.appendChild(document.createTextNode(', '));
  versionLinks.append(htmlLink);
  versionLinks.appendChild(document.createTextNode(')'));
}
