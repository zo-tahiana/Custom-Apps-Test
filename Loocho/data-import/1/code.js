var self = this;

/**
 * mimeTypeAccepted
 *
 * List of the mimeType accepted for importing
 * @type {Array}
 */
this.mimeTypeAccepted = ['application/vnd.ms-excel'];

/**
 * step
 *
 * @type {Number}
 */
this.step = 1;

/**
 * This variable who stock all files input by the user
 *
 * @type {Array} files
 */
this.files = [];

/**
 * This variable who stock the account properties
 *
 * @type {Array} accountProperties
 */
this.accountProperties = [];

/**
 * showMessage
 *
 * @param {String} title
 * @param {String} message
 */
this.showMessage = function (title, message) {
  self.modalTitle = title;
  self.modalMessage = message;
};

/**
 * closeModal
 */
this.closeModal = function () {
  self.modalMessage = self.modalTitle = self.viewerDataProperty = self.viewerDataContents = null;
  self.modalSize= 'md';
};

/******************************************************************************************
 * NEXT AND PREVIEW BUTTON
 ******************************************************************************************/

/**
 * browseFile
 */
this.browseFile = function () {
  return document.getElementById('input-file-import').click();
};

/**
 * next
 */
this.next = function () {
  if (this.step === 1) this.hasAResource();
  if (this.step < 3 && this.hasAResource()) {
    this.step++;
    self.errorMessage = '';
    self.infoMessage = '';
  }
  if (this.step === 2) this.toMap(this.files[0]);
};

/**
 * preview
 */
this.preview = function () {
  if (this.step > 1) {
    this.step--;
    self.errorMessage = '';
    self.infoMessage = '';
  }
  if (this.step === 1) self.setDropZoneEvent();
  if (this.step === 2) {
    this.toMap(this.files[0]);
    this.importInProgress = false;
  }
};

/**
 * disabledNextOrPrevBtn
 *
 * @param {String} btn
 */
this.hideNextOrPrevBtn = function (btn) {
  if (btn === 'next') return this.step === 3 || !this.files.length;
  if (btn === 'prev') return this.step === 1;
};

/******************************************************************************************
 * STEP ONE
 ******************************************************************************************/

/**
 * getListOwner
 */
this.getListOwner = function () {
  return self.customData.data['login/user'].data;
};

/**
 * readFile
 *
 * Read file and stock his content in `filesData`
 * @param {Object} file
 */
this.readFile = function (file) {
  var reader = new FileReader();
  // Init resultMapping property
  file.resultMapping = [];

  // Generate ID of file
  file._id = Math.random().toString().split('.')[1];

  // Resource Auto-select
  self.autoSelectRes(file);

  // Size convert en Kb
  self.convertSize(file);

  // Set owner default value
  file.owner = self.getListOwner() && self.getListOwner()[0] && self.getListOwner()[0]._id;

  // Set accountProperties
  if (file.resource.name !== 'account') {
    var resources = self.customData.config.resources;
    file.account = resources.find(function (core) { return core.name === 'account' });
    file.account.jsonSchema = typeof file.account.jsonSchema === 'string' ? JSON.parse(file.account.jsonSchema) : file.account.jsonSchema;
    file.account.schemaGenerated = self.accountProperties = self.generateSchema(file, 'Account');
    file.account.resultMapping = [];
  }

  // Read csv file and send the array of lines to the callback
  reader.onload = (function (event) {
    var lines = [];
    var csv = event.target.result.split(/\r\n|\n/);
    while (csv.length) { lines.push(csv.shift().split(',')); }
    file.lines = lines;
  });

  reader.readAsText(file);
  // Push all file in one array
  return self.files.push(file);
};

/**
 * autoSelectRes
 *
 * Resource auto select for each files
 * @param {Object} file
 */
this.autoSelectRes = function (file) {
  var fileName = file && file.name && file.name.replace('.csv', '');
  if (/(deals|deal)/i.test(fileName)) fileName = 'opportunity';
  if (/(tasks|task)/i.test(fileName)) fileName = 'activity';
  if (/(company|account|organisation|organization)/i.test(fileName)) fileName = 'account';

  this.listOfRessource().forEach(function (resource) {
    var reg_1 = new RegExp(fileName, 'i');
    var reg_2 = new RegExp(resource.name, 'i');
    if (reg_1.test(resource.name) || reg_2.test(fileName)) return self.changeResource(resource.name, file);
  });
};

/**
 * convertSize
 *
 * @param {Object} file
 */
this.convertSize = function (file) {
  var addMillierSeparator = function (nStr) {
    nStr += '';
    var x = nStr.split('.');
    var x1 = x[0];
    var x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
      x1 = x1.replace(rgx, '$1' + '.' + '$2');
    }
    return x1 + x2;
  };

  file.sizeKb = file && file.size && addMillierSeparator(parseInt(file.size / 1000));
};

/**
 * Filter files downloaded
 *
 * @param {Object} files
 */
this.filterFiles = function (files) {
  self.errorMessage = '';
  for (var i = 0; i < files.length; i++) {

    //Ignore all files having the bad mimeType
    if (self.mimeTypeAccepted.indexOf(files[i].type) === -1) {
      return self.errorMessage = 'The type of your file does not allowed, please import CSV files only';
    }

    // Test if this file is already loaded
    var isReaded = self.files.filter(function (file) {
      return file.name === files[i].name && file.size === files[i].size && file.lastModified === files[i].lastModified;
    });

    // Test if the file is already in the list
    if (!isReaded.length) self.readFile(files[i]);
  }
};

/**
 * handleFileSelect
 *
 * @param {Object} evt
 */
this.handleFileSelect = function (evt) {
  document.getElementById('my-drop-zone').style.border = 'dashed 3px lightgray';
  evt.stopPropagation();
  evt.preventDefault();
  return self.filterFiles(evt.dataTransfer.files);
};

/**
 * handleDragOver
 *
 * @param {Object} evt
 */
this.handleDragOver = function (evt) {
  document.getElementById('my-drop-zone').style.border = 'dashed 3px rgb(86, 181, 139)';
  evt.stopPropagation();
  evt.preventDefault();
  evt.dataTransfer.dropEffect = 'copy';
};

/**
 * setDropZoneEvent
 *
 * Setup the drag and drop listeners.
 */
this.setDropZoneEvent = function () {
  setTimeout(function () {
    var dropZone = document.getElementById('my-drop-zone');
    dropZone.addEventListener('dragover', self.handleDragOver);
    dropZone.addEventListener('drop', self.handleFileSelect);
    dropZone.addEventListener('dragleave', function (evt) {
      document.getElementById('my-drop-zone').style.border = 'dotted 3px lightgray';
    });
  }, 1);
};
this.setDropZoneEvent();

/**
 * removeFile
 *
 * @param {Object} file
 */
this.removeFile = function (file) {
  var _id = file._id;
  // Delete file
  this.files.forEach(function (file, index) {
    if (file._id === _id) self.files.splice(index, 1);
  });

  if (this.step === 2) {

    // If all files are deleted by user, return to step 1
    if (!this.files.length) {
      this.step--;
      self.setDropZoneEvent();
    }

    // If current file mapping in progress is deleted, init this variable
    if (this.currentFileToMap._id === file._id) {
      this.columnHeader = this.loochoProperty = [];
      this.currentFileToMap = {};
    }
  }
};

/**
 * listOfRessource
 *
 * Find all resource name not undivided for the list to choose by user
 * @return {Array} string[]
 */
this.listOfRessource = function () {
  var resources = self.customData.config.resources;
  var notUndivided = resources.filter(function (core) { return !core.undivided });
  var coreList = notUndivided.map(function (core) {
    core.appAndCore = core.app + '/' + core.name;
    return core;
  });
  return coreList;
};

/**
 * changeResource
 *
 * @param {String} value e.g `contact`
 * @param {Object} file
 */
this.changeResource = function (value, file) {
  var resources = self.customData.config.resources;
  file.resource = resources.find(function (core) { return core.name === value });
  file.resource.jsonSchema = typeof file.resource.jsonSchema === 'string' ? JSON.parse(file.resource.jsonSchema) : file.resource.jsonSchema;
  file.resource.schemaGenerated = this.generateSchema(file);

  if (file._id !== this.currentFileToMap._id) return;
  this.autoMapping(file);

  // If user change a resource and there is a currentFileToMap value, load loochoProperty...
  if (this.step === 2 && this.currentFileToMap._id) {
    this.initColLabFromLoocho(); // Making empty initColLabFromLoocho
    this.loochoProperty = file.resource.schemaGenerated;
    // If user select a resource that he has already mapped, load resultMap...
    if (file.resource.name === value && file.resultMapping.length) this.autoDragAndDrop(file);
  }
};

/**
 * hasAResource
 *
 * Check if each file to import have a resource
 * @return {boolean}
 */
this.hasAResource = function () {
  var hasNotResource = self.files.filter(function (file) { return !file.resource });
  if (hasNotResource.length) {
    var hasNotResourceList = JSON.stringify(hasNotResource.map(function (file) { return file.name }))
      .replace('[', '').replace(']', '');
    self.errorMessage = 'Resource required, choose a resource for ' + hasNotResourceList + ' file';
  }

  return !(!!hasNotResource.length);
};

/**
 * generateSchema
 *
 * @param {Object} file
 * @param {String} resourceName
 * @return {Array} any[] or array[]
 */
this.generateSchema = function (file, resourceName) {
  var schemaGenerated = [];
  var forEachObject = function (data, callback) {
    for (var key in data) { callback(data[key], key); }
  };

  /**
   * key = "phones", type = "array", data = {sectionTitle: "Phone numbers", sectionIcon: "phone", number: Object, place: Object}
   */
  var setValue = function (data, key, type) {
    // e.g: phones: [{ number: 'string'}, { place: 'string' }] and location: { addr: 'string, country: 'string, city: 'string' }
    if (type === 'array' || type === 'section') {
      var array = [];

      /**
       * value = {title: "City", type: "string"} , property = 'city'
       */
      forEachObject(data, function (value, property) {
        if (['sectionIcon', 'sectionTitle'].indexOf(property.trim()) === -1) {
          var title = key.charAt(0).toUpperCase() + key.slice(1) + ' ' + value.title.trim();
          // If there is a resourceName `Account` title = e.g Account / Location City
          title = resourceName ? resourceName + ' / ' + title : title || key;

          var id = 'drag-' + key + '-' + property.trim();
          // If there is a resourceName `Account` id = e.g: Account-drag-city
          id = resourceName ? resourceName + '-' + id : id;

          var label = data.sectionTitle;
          // If there is a resourceName `Account` label = e.g: Account / Phones
          label = resourceName ? resourceName + ' / ' + label : label;

          var obj = { key, id, title, label, field: key + '.' + property.trim(), subProp: property };

          //if (type === 'section') schemaGenerated.push(obj);
          if (type === 'array') {
            obj.index = 1;
            obj.title += ' #1';
            obj.id += '-#1';
            obj.increment = true;
          }
          array.push(obj);
        }
      });
      return schemaGenerated.push(array);

      // e.g { title: 'name', type: 'string' }
    } else {
      /**
       * Generate object
       * If there is a resourceName `Account` id = e.g: Account-drag-name
       * If there is not a resourceName `Account` id = e.g drag-name
       */
      var id = resourceName ? resourceName + '-drag-' + key : 'drag-' + key;
      var label = resourceName ? resourceName + ' / ' + data.title : data.title || key;
      var obj = { label, key, id };
      obj.title = data.title || key;
      obj.field = key;
      schemaGenerated.push(obj);

      /**
       * If data type is `money` e.g amount: { title: 'Amount', type: 'money' }
       * Create currency property
       */
      if (data.type === 'money') {
        id += '-currency';
        label = data.title + ' / Currency';
        obj = { label, key, id, title: label };
        obj.field = key + '$CUR';
        schemaGenerated.push(obj);
      }
    }
  };

  // If there is a resourceName `Account`, so use jsonSchema of account
  var jsonSchema = resourceName ? file.account.jsonSchema : file.resource.jsonSchema;
  forEachObject(jsonSchema, function (value, key) {
    if (Array.isArray(value)) setValue(value[0], key, 'array');
    else if (value.hasOwnProperty('sectionTitle') && typeof value === 'object' && !Array.isArray(value)) setValue(value, key, 'section');
    else setValue(value, key);
  });

  return schemaGenerated;
};

/******************************************************************************************
 * STEP TWO
 ******************************************************************************************/

/**
 * Headers of file selected for mapping
 * @type {Array}
 */
this.columnHeader = [];

/**
 * loochoProperty
 *
 * Loocho property according to the resource of file selected for mapping
 * @type {Array}
 */
this.loochoProperty = [];

/**
 * ID of file selected in progress of mapping
 * @type {object}
 */
this.currentFileToMap = {};

/**
 * Who stock all logs for each documents imported
 * @type {Array}
 */
this.feedbacks = [];

/**
 * createDocFrequency
 * @type {number}
 */
this.createDocFrequency = 1;

/**
 * AutoMapping
 *
 * @param {Object} file
 */
this.autoMapping = function (file) {
  var headers = file.lines && file.lines[0];
  var loochoProperty = file.resource && file.resource.schemaGenerated;

  // Loop headers of the CSV file
  return headers.forEach(function (header, nbCol) {
    // Loop schema generated
    return loochoProperty.forEach(function (prop) {

      // Function who generate result object
      var generateResult = function (prop) {
        // Create object for resultMapping property
        var result = { col: nbCol, field: prop.field, header, title: prop.title, id: prop.id };
        // Test if the header is already exist in resultMapping
        var isNotAlreadyExist = file.resultMapping.every(function (elem) { return elem.header !== header; });
        // Push result found
        if (isNotAlreadyExist) file.resultMapping.push(result);
      };

      // Creating regex for search method
      var headerModified = header.replace(/(-|_)/, ' ');
      var reg = new RegExp(headerModified, 'i');

      // If prop is array e.g: [{ field: string, index: 1 }, { field: string, index: 2 }]
      if (Array.isArray(prop)) {
        //titleSearch = prop[0].title && prop.title.search(reg) !== -1;
        return prop.forEach(function (subProp) {
          var titleSearch = subProp.title && subProp.title.search(reg) !== -1;
          var keySearch = subProp.key && subProp.key.search(reg) !== -1;
          var labelSearch = subProp.label && subProp.label.search(reg) !== -1;
          if (titleSearch || keySearch || labelSearch) return generateResult(subProp);
        });
      }

      // Not make an automapping for owner
      if (/owner/i.test(prop.key) || /owner/i.test(prop.label)) return;

      // If resource of file is not an account, so auto-mapping account
      if (file.resource.name !== 'account') {
        if (/account/i.test(prop.key) || /account/i.test(prop.label)) {
          if (['company_name', 'company', 'organisation_name', 'account', 'organisation'].indexOf(header) !== -1) {
            return generateResult(prop);
          }
        }
      }

      // Check if regex return an index
      var labelSearch = prop.label && prop.label.search(reg) !== -1;
      var keySearch = prop.key && prop.key.search(reg) !== -1;
      var titleSearch = prop.title && prop.title.search(reg) !== -1;
      if (labelSearch || keySearch || titleSearch) return generateResult(prop);
    });
  });
};

/**
 * toMap
 *
 * @param {Object} file
 */
this.toMap = function (file) {
  // If there is not a resultMapping, make an automapping
  if (!file.resultMapping.length) this.autoMapping(file);
  // If the current file is not the new file selected, launch initColLabFromLoocho
  if (this.currentFileToMap._id !== file._id) this.initColLabFromLoocho();

  return setTimeout(function () {
    // Update the file of the currentFileToMap
    self.currentFileToMap = file;
    // Update the columnHeader in the `Column label from CSV`
    self.columnHeader = file.lines[0];
    // Update loochoProperty in the `Loocho properties` column
    self.loochoProperty = file.resource.schemaGenerated;
    if (file.resource.name === 'account') {
      var propsString = JSON.stringify(self.loochoProperty);
      propsString = propsString && propsString.replace(/Account \//g, '');
      self.loochoProperty = Object.keys(propsString).length && JSON.parse(propsString);
    }
    // Make an autoDrag and drop
    return self.autoDragAndDrop(file);
  }, 100);
};

/**
 * addOneField
 *
 * @param {Object} field
 */
this.addOneField = function (field) {
  var length = field.length;
  var nbLastField = field[length - 1] ? field[length - 1].index : null;
  var pair = nbLastField ? length / Number(nbLastField) : null;

  for (var i = 0; i < pair; i++) {
    // Create new element
    var newTitle = field[i].title.split(' #');
    var newId = newTitle[0].toLowerCase().replace(' ', '-');
    var newF = { index: nbLastField + 1 };
    newF = Object.assign(newF, {
      key: field[i].key,
      title: newTitle[0] + ' #' + newF.index,
      id: 'drag-' + newId + '-#' + newF.index,
      field: field[i].field
    });
    field.push(newF);
  }
};

/**
 * Drag and Drop for mapping step
 */
this.drag = function (event) {
  event.dataTransfer.setData('dragId', event.target.id);
  var parentNode = event.target && event.target.parentNode && event.target.parentNode;
  event.dataTransfer.setData('areaDropZoneBefore', parentNode.id);
};

this.dragLeave = function (event, trDropZone) {
  trDropZone.style.border = '0';
};

this.dragOver = function (event, trDropZone) {
  event.preventDefault();
  trDropZone.style.border = 'dashed 3px rgb(86, 181, 139)';
};

this.drop = function (event, trDropZone, headerDropZone, CSVinfo) {
  trDropZone.style.border = '0';

  // If the headerDropZone has already a loochoProperty, use can't insert a new property again
  if (headerDropZone.innerText) this.removeLoochoProperty(headerDropZone, CSVinfo.nbCol, true);

  event.preventDefault();

  // Get node of the dragId
  var data = document.getElementById(event.dataTransfer.getData('dragId'));

  // Find value of header, col and field
  var header = CSVinfo.header;
  var col = CSVinfo.nbCol;
  var field = data && data.children && data.children[0] && data.children[0].className;
  var key = data && data.children && data.children[1] && data.children[1].className;
  var id = data && data.children && data.children[2] && data.children[2].className;

  // Find current file
  var file = this.files.filter(function (file) { return file._id === self.currentFileToMap._id; })[0];

  // If node is owner element... Show message;
  if (/owner/i.test(title) || /owner/i.test(field) || /owner/i.test(key) || /owner/i.test(header)) {
    var owner = this.getListOwner().find(function (elem) { return elem._id === file.owner; });
    var message = 'The Owner property cannot be set from the CSV file. Owner will be set to `' + owner.name + '` for all records of this file';
    return self.showMessage('Owner value', message);
  }

  // Move element and set value of title
  if (data) headerDropZone.appendChild(data);
  var title = headerDropZone && headerDropZone.innerText && headerDropZone.innerText.trim();

  // Get node of the areaDropZoneBefore and hide close button
  var areaBefore = document.getElementById(event.dataTransfer.getData('areaDropZoneBefore'));
  var closeBtn = areaBefore.children[0];
  if (closeBtn) closeBtn.style.display = 'none';

  // Display close button
  closeBtn = headerDropZone.children[0];
  if (closeBtn) closeBtn.style.display = 'inherit';

  // If node is account element, push mapping to the account object
  if (/Account /.test(title)) return file.account.resultMapping.push({ header, col, title, field, id });
  var resultIndex = file.resultMapping.findIndex(function (elem) { return elem.header === header; });

  if (resultIndex !== -1) return file.resultMapping[resultIndex] = { header, col, title, field, id };
  return file.resultMapping.push({ header, col, title, field, id });
};

/**
 * removeLoochoProperty
 *
 * @param {Object} headerDropZone
 * @param {Number} nbCol
 * @param {Boolean} replaceProp
 */
this.removeLoochoProperty = function (headerDropZone, nbCol, replaceProp) {
  var srcElement = headerDropZone.getElementsByClassName('draggable')[0];
  var loochoPropId = srcElement && srcElement.id && srcElement.id.trim();

  // Append elemn to the Loocho properties column
  var targetId = document.getElementById(loochoPropId + '-prop');
  targetId.appendChild(srcElement);

  // Hide close button
  var closeBtn = headerDropZone.children[0];
  if (closeBtn) closeBtn.style.display = 'none';

  // Delete elem in resultMapping object
  var file = this.files.filter(function (file) { return file._id === self.currentFileToMap._id; })[0];
  // If the node is account element, use resultMapping for account
  var objectToUse = /Account-/.test(loochoPropId) ? file.account.resultMapping : file.resultMapping;
  return objectToUse.findIndex(function (elem, index) {
    if (elem.col === nbCol) return objectToUse.splice(index, 1);
  });
};

/**
 * viewer
 *
 * @param {Object} file
 */
this.viewer = function (file) {
  // Set viewerDataProperty and viewerDataContents value
  // Include account resultMap in the viewerDataProperty
  self.viewerDataProperty = file.resultMapping.concat(file.account.resultMapping);
  // Take 100 lines for viewer, delete the lines headers of CSV `index 0`
  self.viewerDataContents = file.lines.slice(1, 100);
};

/**
 * autoDragAndDrop
 *
 * @param {String} file
 */
this.autoDragAndDrop = function (file) {
  var initResultsMap = setInterval(function () {
    var resultsMapElem = document.getElementById('resultsMap');
    var resultsMapTrElems = resultsMapElem && resultsMapElem.children;

    // Watching if resultsMap id is onloaded on the template
    if (resultsMapTrElems) {
      clearInterval(initResultsMap);
      var autoDragAndDropProcess = function (resultsMap) {
        return resultsMap.forEach(function (result) {
          var tdElem = document.getElementById('drop-' + result.header);
          var propElem = document.getElementById(result.id);
          if (propElem && tdElem) {
            // Display close button
            var closeBtn = tdElem && tdElem.children && tdElem.children[0];
            if (closeBtn) closeBtn.style.display = 'inherit';
            if (tdElem) {
              if (!tdElem.innerText) return tdElem.appendChild(propElem);
            }
          }
        });
      };

      var resultMapData = file.resultMapping || [];
      var resultMapAccount = file.account ? file.account.resultMapping || [] : [];
      autoDragAndDropProcess(resultMapData);
      autoDragAndDropProcess(resultMapAccount);
    }
  }, 30);
};

/**
 * initColLabFromLoocho
 *
 * Making empty the `Column label from Loocho` column
 */
this.initColLabFromLoocho = function () {
  var initResultsMap = setInterval(function () {
    var resultsMapElem = document.getElementById('resultsMap');
    var resultsMapTrElems = resultsMapElem && resultsMapElem.children;

    if (resultsMapTrElems) {
      clearInterval(initResultsMap);
      for (var i = 0; i <= resultsMapTrElems.length; i++) {
        if (resultsMapTrElems[i]) {
          var tdParent = resultsMapTrElems[i] && resultsMapTrElems[i].children[1];
          var tdElem = tdParent && tdParent.children[1];
          // Get tr element in the loocho-property
          var tdElemLoochoPropertyId = tdElem && tdElem.id + '-prop';
          var tdElemLoochoPropertyNode = document.getElementById(tdElemLoochoPropertyId);
          // Hide close btn
          var closeBtn = tdParent && tdParent.children[0];
          if (closeBtn) closeBtn.style.display = 'none';
          // Remove loocho property elem
          if (tdElem && tdElemLoochoPropertyNode) {
            // Test if the tr element has a children having this tdElem
            var isExist = tdElemLoochoPropertyNode.getElementsByTagName('td').length;
            if (!isExist) tdElemLoochoPropertyNode.appendChild(tdElem);
          }
          else if (!tdElemLoochoPropertyNode && tdElem) tdElem.parentNode.removeChild(tdElem);
        }
      }
    }
  }, 30);
};

/**
 * createDoc
 *
 * @param {Object} file
 * @param {boolean} isAccount
 * @param {Function} callback
 */
this.createDoc = function (file, isAccount, callback) {
  var dataToGenerate = isAccount && file.account ? file.account.schemaGenerated : file.resource.schemaGenerated;
  var resultMapping = isAccount && file.account ? file.account.resultMapping || []: file.resultMapping || [];

  // Get schema according to this properties
  var schemasList = [];
  dataToGenerate.forEach(function (schema) {
    var stringify = JSON.stringify(schema);
    resultMapping.forEach(function (resultMap) {
      var loochoProp = '"title":"' + resultMap.title + '"';
      if (stringify.indexOf(loochoProp) !== -1) schemasList.push(schema);
    });
  });

  // Find all value of column and collecte the field value in result map
  var colValues = resultMapping.map(function (result) {
    result.colValues = file.lines.map(function (column) {
      return column[result.col];
    });

    schemasList.forEach(function (schema) {
      if (!Array.isArray(schema) && schema.title === result.title) result.field = schema.field;
      if (Array.isArray(schema)) {
        schema.forEach(function (schemaObj) {
          if (schemaObj.title === result.title) {
            result.field = schemaObj.field;
            result.index = schemaObj.index;
          }
        });
      }
    });
    return result;
  });

  // Create document
  var documents = [];
  colValues.forEach(function (col) {
    col.colValues.forEach(function (celluleValue, key) {

      var doc = { owner: file.owner };
      var fieldSplitted;
      if (celluleValue && celluleValue !== '""') {
        // e.g: location: { addr: 'string, country: 'string, city: 'string' } and { fname: 'string' }
        if (!col.index) {
          var property = col.field;
          fieldSplitted = property.split('.');

          // e.g: location: { addr: 'string, country: 'string, city: 'string' }
          // TODO: If the property has a subprop and subsubprop and subsubsuprop ...
          if (fieldSplitted.length > 1) {
            doc[fieldSplitted[0]] = {};
            doc[fieldSplitted[0]][fieldSplitted[1]] = celluleValue;
            if (!documents[key]) documents.push(doc);
            if (!documents[key][fieldSplitted[0]]) documents[key][fieldSplitted[0]] = {};
            documents[key][fieldSplitted[0]][fieldSplitted[1]] = celluleValue;

            // e.g: { fname: 'string' }
          } else {
            doc[property] = celluleValue;
            if (!documents[key]) documents.push(doc);
            documents[key][property] = celluleValue;
          }

          // e.g: phones: [{ number: 'string'}, { place: 'string' }]
          // TODO: If the property has a subprop and subsubprop and subsubsuprop ...
        } else {
          fieldSplitted = col.field.split('.');
          if (!documents[key]) documents.push(doc);
          if (!documents[key][fieldSplitted[0]]) documents[key][fieldSplitted[0]] = [];
          if (!documents[key][fieldSplitted[0]][col.index]) {
            var obj = {};
            obj[fieldSplitted[1]] = celluleValue;
            documents[key][fieldSplitted[0]].push(obj);
          }
        }

      } else if (!documents[key]) {
        documents.push(doc);
      }
    });
  });

  return callback(documents);
};

/**
 * generateFeedbacks
 *
 * Generate feedbacks
 * @param {String} fileName
 * @param {String} message
 * @param {Number} progress
 */
this.generateFeedbacks = function (fileName, message, progress) {
  var date = new Date();
  var feed = { on: date.toDateString() + ' ' + date.toLocaleTimeString(), file: fileName, message };
  var index = self.feedbacks.findIndex(function (elem) { return elem.message.includes(message) });

  if (index === -1) return self.feedbacks.push(feed);
  if (progress) feed.message += ' ' + progress + '%';
  return self.feedbacks[index] = feed;
};

/**
 * accountManager
 *
 * @param {Object} file
 * @param {Array} documents
 * @param {Function} cb
 */
this.accountManager = function (file, documents, cb) {
  if (!file.account) return cb(documents);
  // Init account progression
  document.getElementById('account-progression').style.width = 0;

  return new Promise(function (resolve, reject) {
    // Get all accounts found in the base
    return self.getData('core/account', null, function (err, data) {
      if (err) return reject(err);
      return resolve(data.data);
    });
  }).then(function (accountsInBase) {
    self.generateFeedbacks(file.fileName, 'Creation of documents for Account...');
    // Create documents for accounts
    return self.createDoc(file, true, function (accountsDocuments) {
      var accountToCreate = [];
      // Change account value to id if this is already exist in database
      var docWithAccountId = documents.map(function (doc, line) {
        var accountForDoc = accountsInBase.find(function (account, index) { return doc.account === account.name; });
        if (accountForDoc) doc.account = accountForDoc._id;
        else {
          // If user does not set an account elements
          if (!accountsDocuments[line]) accountsDocuments[line] = { owner: file.owner };
          // If user does not set the element `Account / Name`, so name of account is the value adequate to the account property of the resource selected
          if (!accountsDocuments[line].name) accountsDocuments[line].name = doc.account;
          // Create account to create
          accountToCreate.push({ line, doc: accountsDocuments[line] });
        }
        return doc;
      });

      if (!accountToCreate.length) return cb(docWithAccountId);

      // Create accounts
      self.generateFeedbacks(file.fileName, 'Creation of Account...');

      var accountToCreateNb = accountToCreate.slice().length;
      var accountCreated = 0;
      var createDataFreq = function (docs) {
        return docs.forEach(function (doc, index) {
          return self.createData('core/account', doc.doc, function (err, created) {
            accountCreated++;

            var progress = Math.floor((accountCreated * 100) / accountToCreateNb);
            //Account progress
            document.getElementById('account-progression').style.width = progress + '%';
            self.generateFeedbacks(file.fileName, 'Creation of Account...', progress);
            // If error delete account property for doc
            if (err) {
              delete docWithAccountId[line] && docWithAccountId[line].account;
              return console.error(err);
            }
            // Change account value to account _id of account created
            if (docWithAccountId[doc.line]) {
              if (docWithAccountId[doc.line].account) docWithAccountId[doc.line].account = created._id;
            }

            // delete account created
            accountToCreate.splice(index, 1);
            // Send documents with _id value of account property
            if (docs.length === index + 1) {
              if (!accountToCreate.length) {
                self.generateFeedbacks(file.fileName, 'Creation of Account finished...');
                return cb(docWithAccountId);
              }

              return setTimeout(function () {
                return createDataFreq(accountToCreate.slice(0, 1));
              }, self.createDocFrequency);
            }
          });
        });
      };

      return createDataFreq(accountToCreate.slice(0, 1));
    });
  }, function (err) {
    return console.error(err);
  });
};

/**
 * importData
 */
this.importData = function () {
  this.nbToImport = 0;
  this.totalCreated = 0;
  this.totalError = 0;
  this.importInProgress = true;
  this.infoMessage = 'Import of your data is in progress... Please do not close this window or navigate to other parts of the application';

  var start = 0;
  var importProcess = function (file) {
    var core = file.resource.app + '/' + file.resource.name;
    file.fileName = file.name && file.name.replace('.csv', '');

    return new Promise(function (resolve, reject) {
      self.generateFeedbacks(file.fileName, 'Preparation of documents creation...');
      return self.createDoc(file, false, function (documents) {
        self.generateFeedbacks(file.fileName, 'Creation of documents for ' + file.fileName + ' file...');
        return resolve(documents);
      });
    }).then(function (documents) {
      self.generateFeedbacks(file.fileName, 'Creation of documents finished for ' + file.fileName + ' file...');
      self.generateFeedbacks(file.fileName, 'Account verification and creation for ' + file.fileName + ' file...');
      self.generateFeedbacks(file.fileName, 'Connection to database...');

      self.nbToImport += (documents.length - 1);
      file.nbImported = 0;
      file.totalError = 0;
      file.totalCreated = 0;

      return self.accountManager(file, documents, function (docsToImport) {
        var createDocFreq = function (doc) {
          // Import data to the custom resource
          return self.createData(core, doc, function (err, created) {
            file.nbImported++;

            if (err) { self.totalError++; file.totalError++; }
            if (!err) { self.totalCreated++; file.totalCreated++; }

            // Calc import progress
            file.progress = Math.floor((100 * file.nbImported) / (documents.length - 1));
            file.progress = file.progress > 100 ? 100 : file.progress;
            document.getElementById(file._id + '-data').style.width = file.progress + '%';

            self.generateFeedbacks(file.fileName, 'Importing ' + file.fileName + ' file in progress... ', file.progress);

            // If import is finished
            if (!self.files[start]) {
              if (self.nbToImport === (self.totalError + self.totalCreated)) {
                self.infoMessage = 'Import of your data is finished...';
                return self.importDone = true;
              }
            }

            // delete account created
            docsToImport.splice(0, 1);
            if (docsToImport.length) {
              // Doc freq
              return setTimeout(function () {
                return createDocFreq(docsToImport.slice(0, 1));
              }, self.createDocFrequency);
            } else {
              // If import of the file in progress is finished
              // File freq
              if (self.files[start]) importProcess(self.files[start]);
              if (self.files.length > start) return start++;
            }
          });
        };

        return createDocFreq(docsToImport.slice(0, 1));

      });
    });
  };

  // Start import process
  importProcess(self.files[start]);
  return start++;
};

/**
 * sendAReport
 */
this.sendAReport = function () {
  var template = document.getElementById('feedbackTemplate');
  var html = template && template.innerHTML;
  var to = self.customData.config.user.email;
  var subject = 'Report of your data import';
  self.infoMessage = 'Sending email ' + to + ' - Subject: ' + subject;
  self.generateFeedbacks('Report', self.infoMessage);

  return self.sendEmail({ to, subject, html }, function (err) {
    if (err) return console.error(err);
    self.infoMessage = 'Email sent to ' + to + ' - Subject: ' + subject;
    self.generateFeedbacks('Report', self.infoMessage);
  });
};
