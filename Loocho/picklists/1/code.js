var self = this;
this.picklists = { data: [] };
this.defaultValues = [];
this.defaultId = [];

// Get the default values of picklist
this.getData('core/picklist', null, function (err, values) {
  var defaultValues = self.defaultValues = values.data.find(function (value) {
    return value._id === 'defaults';
  });

  // reinitialize last date of synchronization for picklist
  if (!defaultValues) return localStorage.setItem('syncOn_core/picklist', '');
  self.defaultValues = defaultValues.list;
  self.defaultId = self.defaultValues.map(function (value) {
    return value._id;
  });
});

/**
 * saveError
 *
 * Store error in 'core/error' resource
 * @param msg
 */
this.saveError = function(msg) {
  self.error = msg;
  self.createData('core/error', { msg, app: 'picklists' });
};

/**
 * createPicklist
 *
 * Create a new picklist
 */
this.createPicklist = function () {
  this.mode = 'create';
  this.currentPicklist = {};
};

/**
 * editPicklist
 *
 * Edit a picklist
 * @param picklist
 */
this.editPicklist = function (picklist) {
  this.mode = 'edit';
  this.currentPicklist = picklist;

  //store the original picklits object for the undo(cancel action)
  this.picklist = JSON.parse(JSON.stringify(picklist));
};

/**
 * savePicklist
 *
 * Save the currentPicklist (created or updated)
 */
this.savePicklist = function () {
  this.error = null;

  // Handle empty field mandatory
  if (!this.currentPicklist._id) return this.saveError('Missing ID');
  if (!this.currentPicklist.desc) return this.saveError('Missing Description');
  var operation = 'replaceData';
  var proceedToSave = function () {
    self.currentPicklist.modOn = self.currentPicklist.creaOn = new Date();

    // Create or update a picklist
    var saveProcess = function () {
      self[operation]('core/picklist', self.currentPicklist, function() {
        if (self.mode === 'create') self.picklists.push(self.currentPicklist);
        if (!self.error) self.mode = self.currentValue = null;
      });
    };

    // Save creation or modification of a picklist if it's not you save
    if (self.currentValue) self.saveValue(null, saveProcess);
    if (!self.error) return saveProcess();
  }
  if (this.mode === 'edit') return proceedToSave();

  // Handle ID duplication and create new picklist
  return this.getData('core/picklist', null, function (err, picklists) {
    var value = picklists.data.find(function (item) {
      return item._id === self.currentPicklist._id;
    });
    if (value) return self.saveError('ID ' + value._id + ' already exist');
    operation = 'createData'
    return proceedToSave();
  });
};

/**
 * cancelAction
 *
 * Cancel a creation or modification of a picklist
 */
this.cancelAction = function() {
  this.error = null;
  var index = this.picklists.indexOf(this.currentPicklist);
  if (this.mode === 'edit') {
    this.cancelValue();
    this.picklists.splice(index, 1, this.picklist);
  }
  this.mode = this.editMode = this.currentPicklist = this.currentValue = null;
};

/**
 * deletePicklist
 *
 * Delete an older picklist
 */
this.deletePicklist = function () {
  var title = 'Delete picklist';
  var msg = 'Your action will permanently delete this picklist, are you sure?';
  var value = null;
  var index = this.defaultId.indexOf(this.currentPicklist._id);
  if (!this.currentPicklist.modOn) {
    msg = 'This picklist is a default picklist. You can therefore not delete it.';
    return this.modalOK(title, msg);
  }

  // Proceed to delete after confirmation
  var proccedToDelete = function () {

    var id = index !== -1 ? value._id : this.currentPicklist._id;
    index = self.picklists.indexOf(self.currentPicklist);

    // Delete or replace from IDB
    self.deleteData('core/picklist', id, function () {
      self.mode = self.value = null;
      if (value) {

        // restore the default value into IndexedDB
        self.customData.registerData('core/picklist', value);

        // Replace the custom picklist in memory by the default value
        return self.picklists.splice(index, 0, value);
      }

      // Remove from memory
      self.picklists.splice(index, 1);
    });
  }
  if (index !== -1) {
    value = this.defaultValues[index];
    msg = 'This picklist is a default picklist that you customized for your team.' +
      'Your action will delete your customization and revert back to the default values of the picklist.';
    return self.modalYesNo(title, msg, proccedToDelete);
  }
  msg = 'Your action will permanently delete this picklist, are you sure ?';
  this.modalYesNo('Delete picklist', msg, proccedToDelete);
};


/**
 * dragStart
 *
 * Handle the dragStart eventListener
 * @param event
 * @param index
 */
this.dragStart = function(event, index) {
  if (!this.editMode && this.mode !== 'create') return;
  event.dataTransfer.setData('text/plain', '');
  this.sourceIndex = index;
  event.target.style.opacity = .5;

};

/**
 * dragEnd
 *
 * Handle the dragEnd eventListener
 * @param event
 */
this.dragEnd = function(event){
  if ((this.editMode || this.mode === 'create') && this.sourceIndex !== null) {
    event.target.style.opacity = 1;
    this.sourceIndex = null;
  }
};

/**
 * dragValue
 *
 * Move up/down a picklist's value
 * @param event
 * @param index
 */
this.dragValue = function (event, index) {
  if (index === this.sourceIndex || (!this.editMode && this.mode !== 'create') || this.sourceIndex === null) return;
  event.preventDefault();
  this.indexOver = index;
};

/**
 * dropValue
 *
 * Move a value to a specific row
 * @param index
 */
this.dropValue = function(index) {
  if (isNaN(this.sourceIndex)) return;
  var list = this.currentPicklist.list;
  var item = list[this.sourceIndex];
  list.splice(this.sourceIndex, 1);
  list.splice(index, 0, item);
  this.indexOver = null;
}

/**
 * addValue
 *
 * Create a new value for the current picklist
 */
this.addValue = function () {
  if (!this.currentPicklist.list) this.currentPicklist.list = [];
  this.currentValue = {};
  if (!this.currentPicklist.list.length) return this.currentValue._id = 1;

  // build an array of id of current value's list
  var tabId = this.currentPicklist.list.map(function (value) {
    return value._id;
  });

  // Auto-increment the value's id
  this.currentValue._id = Math.max.apply(null, tabId) + 1;
};

/**
 * editValue
 *
 * Edit a value of the current picklist selected
 * @param value
 * @param event
 */
this.editValue = function (value, event) {
  if (!this.editMode && this.mode !== 'create') return;
  this.error = null;
  if (/icon-20/.test(event.target.className)) return;
  this.cancelValue();
  this.currentValue = value;
  //save the original value object for the undo(cancel)
  this.value = Object.assign({}, value);
};

/**
 * cancelValue
 *
 * Cancel a creation or modification of the current picklist's value
 */
this.cancelValue = function () {
  this.error = null;
  var index = this.currentPicklist.list.indexOf(this.currentValue);
  this.currentValue = null;
  if (index !== -1) this.currentPicklist.list.splice(index, 1, this.value);
};

/**
 * saveValue
 *
 * Save the value created or updated of the current picklist
 * @param event
 */
this.saveValue = function (event, callback) {
  this.error = null;
  if (event) {
    var key = event.key;
    if (key !== 'Enter' && key !== 'Escape') return;
    if (key === 'Escape') return this.cancelValue();
  }
  var list = this.currentPicklist.list;
  if (!this.currentValue.label) return this.saveError('Missing Label');
  if (this.currentValue.isWon && !self.currentValue.isClosed) return this.saveError('Value not closed can not be won');
  var isClosed = list.filter(function (value) {
    return value.isClosed;
  });

  // handle isClosed value more than two(>2) error
  var isClosedError = function() {
    return self.saveError('Values closed can not be more than two');
  };

  var isWonError = function() {
    return self.saveError('One of closed value must be won');
  };

  if (isClosed.length > 2) return isClosedError();

  var duplicatedLabel;
  for (var i = 0; i < list.length; i++) {
    if (list[i]._id === self.currentValue._id) continue;

    //check value's label duplication
    if (list[i].label === self.currentValue.label) {
      duplicatedLabel = 'Label '+ list[i].label +' already exist in ' + this.currentPicklist._id;
      break;
    }

    // avoid multiple default and isWon value
    if (list[i].isWon && this.currentValue.isWon) delete list[i].isWon;
    if (list[i].default && this.currentValue.default) delete list[i].default;
  }
  if (duplicatedLabel) return this.saveError(duplicatedLabel);
  var isWon = isClosed.filter(function (value) {
    return value.isWon
  });

  // handle error of two closed values but none is won
  if (!isWon.length && isClosed.length === 2 && this.currentValue.isClosed && !this.currentValue.isWon) {
    return isWonError();
  }

  // close the edit mode
  if (list.indexOf(this.currentValue) !== -1) return this.currentValue = null;

  // handle error of insert a second closed values but none is won
  if (!isWon.length && isClosed.length && this.currentValue.isClosed && !this.currentValue.isWon) {
    return isWonError();
  }

  // handle isClosed value more than two(>2) error (createMode)
  if (isClosed.length === 2 && this.currentValue.isClosed) return isClosedError();
  list.push(this.currentValue);

  //let's the user to add another new value
  var _id = this.currentValue._id + 1;
  this.currentValue = { _id };
  if (callback) return callback();
};

/**
 * deleteValue
 *
 * Delete a value of the current picklist
 * @param index
 */
this.deleteValue = function (index) {
  this.currentValue = null;
  this.currentPicklist.list.splice(index, 1);
};

this.pageNb = 1;
this.lastPage = 1;
this.nbRows = 20;
this.pageList = [1];
this.picklists = [];

/**
 * updateList
 *
 * Update the list of the picklists to show when the rows or page is changed
 * @param nbRows
 */
this.updateList = function(nbRows) {
  var offset = (this.pageNb - 1) * this.nbRows;

  // reset the pagination and get only nbRows data
  if (nbRows) {
    this.nbRows = nbRows;
    this.pageNb = 1;
    offset = 0;
  }
  var query = { _limit: this.nbRows, _offset: offset };

  // Get documents from database
  self.getData('core/picklist', query, function(err, picklists) {
    if (err) return self.error = err;
    picklists.data.forEach(function (item) {
      if (item._id === 'defaults') picklists.data.splice(picklists.data.indexOf(item), 1);
    });
    self.picklists = picklists.data;
    self.pageList = [];
    self.lastPage = Math.ceil(picklists.count / self.nbRows);
    self.pageList = Array.from({ length: self.lastPage }, function (v, i) { return i + 1 });
  });
};

this.updateList(20);
