// namespace
var dstj = dstj || {};
dstj.nema = dstj.nema || {};
dstj.gui = dstj.gui || {};

/**
 * Format tags into a html element and append it to the 'output' div.
 * @param {Array} tags An array of DICOM tags.
 */
function showTags(tags) {
  // tabulation
  var tab = '    ';
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
      // #modif add "GenericGroupLength"
      if (group !== '0x0002') {
        text += tab + tab +
          '\'0x0000\': [\'UL\', \'1\', \'GenericGroupLength\'],\n';
      }
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

// load select file or default one.
dstj.gui.onParseButton = function () {
  var dicomVersions = document.getElementById('dicomVersions');
  var selectedVersion = dicomVersions.options[
    dicomVersions.selectedIndex
  ].value;
  var fileInputElement = document.getElementById('fileupload');
  var parser = new dstj.xml.Part06Parser();
  if (selectedVersion) {
    var url = dstj.nema.getDicomPart06Links()[selectedVersion].xml;
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.onload = function () {
      showTags(parser.parsePart06Node(request.responseXML));
    };
    request.send();
  } else if (fileInputElement.files.length === 1) {
    // a file has been selected
    var file = fileInputElement.files[0];
    var reader = new FileReader();
    reader.onload = function (event) {
      var parser = new DOMParser();
      var doc = parser.parseFromString(event.target.result, 'application/xml');
      showTags(parser.parsePart06Node(doc));
    };
    reader.readAsText(file);
  } else {
    // default
    var url2 = './part06.xml';
    var request2 = new XMLHttpRequest();
    request2.open('GET', url2, true);
    request2.onload = function () {
      showTags(parser.parsePart06Node(request2.responseXML));
    };
    request2.send();
  }
}

// last minute
dstj.gui.updateVersionSelect = function () {
  var versionSelect = document.getElementById('dicomVersions');
  var versions = dstj.nema.getDicomVersions();

  var option = document.createElement('option');
  option.disabled = true;
  option.selected = true;
  option.text = 'Select a version';
  option.value = '';
  versionSelect.add(option);

  for (var i = 0; i < versions.length; ++i) {
    option = document.createElement('option');
    option.text = versions[i];
    option.value = versions[i];
    versionSelect.add(option);
  }
  function updateVersionLinks(version) {
    var links = dstj.nema.getDicomPart06Links()[version];

    var xmlLink = document.createElement('a');
    xmlLink.href = links.xml;
    xmlLink.appendChild(document.createTextNode('xml'));
    var htmlLink = document.createElement('a');
    htmlLink.href = links.html;
    htmlLink.appendChild(document.createTextNode('html'));

    var versionLinks = document.getElementById('versionLinks');
    versionLinks.innerHTML = '';
    versionLinks.appendChild(document.createTextNode('(dict (part06): '));
    versionLinks.append(xmlLink);
    versionLinks.appendChild(document.createTextNode(', '));
    versionLinks.append(htmlLink);
    versionLinks.appendChild(document.createTextNode(')'));
  }

  versionSelect.onchange = function (event) {
    updateVersionLinks(event.target.value);
  }
}
