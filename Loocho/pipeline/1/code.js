var self = this;
var STATES = ['scheduled', 'overdue'];

this.config = this.customData.config;
this.allDeals = [];
this.stagesClosed = [];
this.stages = [];
this.deals = [];

// If the image contents are not displayed, upload the media contents from your custom-app by using 'file-upload'.
this.iconSource = this.config.hosts.LOOCHO_FILES + '/mada-dev/pipeline/';

// Define the static style of the header of all stage
this.thStyle = {
  background: 'url("' + this.iconSource + 'stage-arrow.png") no-repeat right',
  'background-size': '25px 100%'
};

// Define here all couple of stage/resources to use in pipeline. Stage from picklist to define each stages.
// And resource to get each deals.
this.coupleStRes = [
  {
    stage: 'lead-status',
    resource: 'core/lead'
  },
  {
    stage: 'opportunity-stages',
    resource: 'core/opportunity'
  }
];

/**
 * getToday
 *
 * Get today's date in 'yyyy-mm-dd' and its timestamp
 */
this.getToday = function () {
  this.today = new Date();
  var day = this.today.getDate();
  var month = this.today.getMonth() + 1;
  var year = this.today.getFullYear();
  if (day < 10) day = '0' + day;
  if (month < 10) month = '0' + month;
  this.month = year + '-' + month;
  this.today = this.month + '-' + day;

  // Define today in millisecond but not Date.now()
  this.timestamp = new Date(this.today).getTime();
  var getNextMonth = function () {
    month = parseInt(month);
    month++;

    // next month after december
    if (month / 12 > 1) {
      year++;
      month = '01';
    }
    else if (month < 10) month = '0' + month;
    return (year + '-' + month);
  };
  this.nextMonth = getNextMonth();
  this.afterNextMonth = getNextMonth();
};

this.getToday();

// 1 day = 24*60*60*1000 ms
var DAY = 86400000;

/**
 * totalDealAndAmount
 *
 * Calculate the count of deals and the sum of the amounts by currency for each stage
 */
this.totalDealAndAmount = function (stage) {
  stage.currencies = [];
  self.deals.forEach(function (deal) {
    if (isNaN(deal.amount)) deal.amount = 0;
    // Don't count the deal and its amount not in the specific state
    if ((!isNaN(self.stateFilter) && self.stateFilter !== deal.delayState) ||
        (self.stateFilter && self.stateFilter.length > 1 && self.stateFilter !== deal.month) ||
        (self.stateFilter === self.afterNextMonth && self.nextMonth >= deal.month)) return;
    var id = deal.stage || deal.status;
    if (deal.resource === stage.resource && id === stage._id) {

      // Initialize each currency of stage.
      if (!deal['amount$CUR']) deal['amount$CUR'] = self.currency;
      if (deal['amount$CUR'] && stage.currencies.indexOf(deal['amount$CUR']) === -1) {
        stage.currencies.push(deal['amount$CUR']);
        stage[deal['amount$CUR']] = { amount: 0, deals: 0 };
      }

      // Count deals and amount by currency
      stage[deal['amount$CUR']].amount += deal.amount;
      stage[deal['amount$CUR']].deals++;
      stage.amount += deal.amount;
      stage.deals++;
    }
  });
};

/**
 * hideAll
 *
 * Hide all other elements in the view except the pipeline visualization (container and popover)
 */
this.hideAll = function () {
  self.showStageContainer = null;
  self.stageOnOver = null;
  self.showPopover = null;
};

/**
 * getDeadline
 *
 * Define the deadline of an activity/deal compared to its delaytime
 * In this function:
 *  - month = 30 days
 *  - year = 1 month * 12 = 360 days
 * @param activity
 * @param delaytime
 */
this.getDeadline = function (activity, delaytime) {

  // Get the absolute value of delay time to define the deadline
  var deadline = Math.abs(delaytime);
  if (deadline === 0) activity.deadline = 'Today';
  else if (deadline === 1) activity.deadline = 'one day';
  else if (deadline < 30) activity.deadline = deadline + ' days';
  else if (parseInt(deadline / 30) === 1) activity.deadline = 'one month';
  else if (parseInt(deadline / 30) < 12) activity.deadline = parseInt(deadline / 30) + ' months';
  else if (parseInt(deadline / 360) === 1) activity.deadline = 'one year';
  else activity.deadline = parseInt(deadline / 360) + ' years';
};

/**
 * sortBy
 *
 * Sort an array of object by a specific property(asc)
 * @param prop
 * @param list
 */
this.sortBy = function (prop, list) {
  list.sort(function (a, b) {
    if (a[prop] > b[prop]) return 1;
    if (a[prop] < b[prop]) return -1;
    return 0;
  });
};

/**
 * setIcon
 *
 * Define the icon to show the delay state
 * state:
 *  0- overdue
 *  1- no closeOn
 *  2- today
 *  4- in soon more than one day
 * @param deal
 */
this.setIcon = function (deal) {

  deal.delayState = 1;

  // Define the deadline of an opportunity compared to its closeOn date.
  if (!deal.closeOn) {
    deal.month = null;
  } else {

    // Compare today and deal's closeOne date in ms
    deal.delaytime = new Date(deal.closeOn).getTime() - this.timestamp;
    deal.month = deal.closeOn.split('-')[0] + '-' + deal.closeOn.split('-')[1];

    // Transform delay time to day(integer)
    deal.delaytime = parseInt(deal.delaytime / DAY);
    this.getDeadline(deal, deal.delaytime);
    if (deal.closeOn === self.today) deal.delayState = 2;
    else if (deal.closeOn < self.today) deal.delayState = 0;
    else if (deal.delaytime < 8) deal.delayState = 3;
    else deal.delayState = 4;
  }
  this.sortBy('delayState', this.deals);
}

/**
 * updateIcon
 *
 * Update the icon of the delay state compared to an activity
 * @param deal
 * @param activity
 */
this.updateIcon = function (deal, activity) {
  if (!deal.delayState) return;
  var month = activity.dueOn.split('-')[0] + '-' + activity.dueOn.split('-')[1];
  if (!deal.month || month < deal.month) deal.month = month;
  activity.delaytime = new Date(activity.dueOn).getTime() - self.timestamp;
  activity.delaytime = parseInt(activity.delaytime / DAY);
  if (activity.dueOn === self.today) deal.delayState = 2;
  else if (activity.dueOn < self.today) deal.delayState = 0;
  else if (deal.delayState === 1){
    if (activity.delaytime < 8) deal.delayState = 3;
    else deal.delayState = 4;
  }
  this.sortBy('delayState', this.deals);
};

/**
 * updatePipeLine
 *
 * Update the pipeline visualization to recalculate the amount and move each deal in the right column(stage)
 */
this.updatePipeLine = function () {
  self.getData('core/picklist', null, function (err, picklists) {
    self.getData('core/activity', null, function (err, activities) {
      self.activities = [];

      // For each resource's type to show as deals
      self.coupleStRes.forEach(function (item) {
        picklists.data.forEach(function (picklist) {

          // Define the default currency of the pipeline(will be use if one deal have not an amount)
          if (picklist._id === 'currencies') {
            picklist.list.forEach(function (value) {
              if (value.default) self.currency = value.label;
            });
          }

          // Use the list of the picklist's value to build the columns of stages(lead-status,opportunity-stages)
          if (picklist._id === item.stage) {
            picklist.list.forEach(function (value) {

              // Add and set resource property to differentiate the type of stage or update deal
              value.resource = item.resource;

              // Don't show the stages changing a deal to closed status among the columns but store into an array
              if (value.isClosed) return self.stagesClosed.push(value);
              self.stages.push(value);
            });

            // Get deals of the current stage's type
            self.getData(item.resource, null, function (err, resources) {
              resources.data.forEach(function (deal) {

                // Set the icon of the deal compared to its estimated closing date (closeOne)
                self.setIcon(deal);

                // Retrieve only the activities for the current deal by ignore activity completed or no dueOn date
                activities.data.forEach(function (activity) {
                  if (activity.doneOn || !activity.dueOn) return;
                  if (activity.opp === deal._id || activity.lead === deal._id) {
                    if (self.activities.indexOf(activity) === -1) self.activities.push(activity);

                    // Update the icon of the deal compared to its current activity's dueOne date(closeOne)
                    self.updateIcon(deal, activity);
                  }
                });

                // Preserve the resource of the deal (from core/lead or core/opportunity)
                deal.resource = item.resource;

                // Preserve all deals and use them for the research
                self.allDeals.push(deal);

                // Use the data member deals in the view and re-use it to getting the result of research
                self.deals = self.allDeals;

                // Short the deals by its delay time
                self.sortBy('delayState', self.deals);

                // Count the deals and the total of amounts in each column(stage) after all are done
                if ((resources.data.indexOf(deal) === resources.data.length - 1) &&
                  (self.coupleStRes.indexOf(item) === self.coupleStRes.length - 1)) {
                  self.stages.forEach(self.totalDealAndAmount);
                }
              });
            });
          }
        });
      });
    });
  });
};

this.updatePipeLine();

/**
 * getIcon
 *
 * Show the icon compared to the deal's delayState
 * @param delayState
 */
this.getIcon = function (delayState) {
  var icon = 'overdue.png';
  if (delayState === 1) icon = 'warning.png';
  else if (delayState === 2) icon = 'today.png';
  else if (delayState > 2) icon = 'in.png';
  return { background: 'url("' + this.iconSource + icon + '") no-repeat center' };
}

/**
 * dragStart
 *
 * Show the stage container to delete or change to lost or won the stage of a deal.
 * @param event
 * @param deal
 */
this.dragStart = function (event, deal) {
  var stages = self.stagesClosed.filter(function (item) {
    return item.resource === deal.resource;
  });
  this.currentStagesClosed = stages;
  event.dataTransfer.setData('text/plain', '');
  this.showPopover = null;
  this.showStageContainer = true;
  if (event.target.style) event.target.style.opacity = .5;
  this.currentDeal = deal;
};

/**
 * dragEnd
 *
 * Hide all html elements showed during the drag event.
 * @param event
 */
this.dragEnd = function (event) {
  if (event.target.style) event.target.style.opacity = 1;
  if (!this.stageOnOver || !this.stageOnOver.resource || this.currentDeal.resource === this.stageOnOver.resource) {
    return this.hideAll();
  }
  var type = this.stageOnOver.resource.split('/')[1];
  var deal = this.currentDeal.resource.split('/')[1];
  this.wrongColumn = true;
  this.message = 'This ' + deal + ' cannot be moved to this column because the column is reserved for ' + type + 's';
  this.hideAll();
};

/**
 * dragLeave
 *
 * Reset stageOnOver'css class
 */
this.dragLeave = function () {
  setTimeout(function () {
    self.stageOnOver = null;
  }, 10);
}

/**
 * dragOver
 *
 * Check if the stage can accept the drop event. If the deal dragged is not from the resource defined with the
 * stage, don't accept the drop event.
 * @param event
 * @param stage
 */
this.dragOver = function (event, stage) {
  this.stageOnOver = stage;
  if (!stage.resource || this.currentDeal && this.currentDeal.resource === stage.resource) event.preventDefault();
};

/**
 * drop
 *
 * Change the stage of the deal or delete it.
 * @param event
 */
this.drop = function (event) {
  event.preventDefault();

  // Te current deal dropped may be a lead(hasStatus) or an opportunity(hasStage)
  var id = this.currentDeal.status || this.currentDeal.stage;

  // Cancel the update action if the deal has not been moved on another column
  if (id === this.stageOnOver._id) return;

  // Update the count of deal and amount for the stage source
  this.findStageAndCount(this.currentDeal);

  // Handle the drop event (Delete, Won, Lost or Just Closed)
  if (typeof this.stageOnOver === 'string') {
    if (this.stageOnOver === 'delete') {
      var typeDeal  = this.currentDeal.resource.split('/')[1];
      var msg = 'Your action will permanently delete this '+ this.currentDeal.resource.split('/')[1] +', are you sure ?';
      return self.modalYesNo('Delete ' + typeDeal, msg, function () {

        // Delete deal from IndexedDB
        self.deleteData(self.currentDeal.resource, self.currentDeal._id);

        // Remove deal from memory(RAM)
        self.deals.splice(self.deals.indexOf(self.currentDeal), 1);
        return self.findStageAndCount(self.currentDeal);
      });
    }

    // Just close the deal because we have no choice (won or lost)
    if (this.currentStagesClosed.length === 1) this.stageOnOver = this.currentStagesClosed[0];
    else {

      // set stageOnOver to an object among the stages for closing a deal
      this.stageOnOver = this.currentStagesClosed.find(function (item) {
        return self.stageOnOver === 'won' ? item.isWon : !item.isWon;
      });
    }
  }

  // If deal from 'core/lead' resource, set its status. Else set its stage.
  if (this.currentDeal.resource === 'core/lead') this.currentDeal.status = this.stageOnOver._id;
  else this.currentDeal.stage = this.stageOnOver._id;

  // Clone the current deal by removing all useless properties to store
  var data = JSON.parse(JSON.stringify(this.currentDeal));
  delete data.resource;
  if (data.delayState) delete data.delayState;
  if (data.delaytime) delete data.delaytime;
  if (data.deadline) delete data.deadline;
  if (data.month) delete data.month;
  this.replaceData(this.currentDeal.resource, data);
  this.totalDealAndAmount(this.stageOnOver);
  this.hideAll();
};

/**
 * createNew
 *
 * Create a new deal. It can be lead(resource === 'core/lead') or opportunity(resource === 'core/opportunity').
 * @param resource
 */
this.createNew = function (resource) {
  this.resource = resource;
  var data = {};
  var prop = /lead/.test(resource) ? 'status' : 'stage';

  // Place the new deal to a default stage or status. If no default, place it in the first column.
  this.stages.forEach(function (item) {
    if ((!data[prop] && !item.isClosed) || item.default) data[prop] = item._id;
  });
  this.editDoc = data;
};

/**
 * findStageAndCount
 *
 * Find stage related to the deal and count the total deal and amount
 * @param deal
 */

this.findStageAndCount = function (deal) {
  var id = deal.stage || deal.status;
  var status = this.stages.find(function(stage) {
    return (stage.resource === deal.resource && (stage._id === id));
  });
  if (!status) return;
  setTimeout(function () {
    delete status[deal['amount$CUR']];
    self.totalDealAndAmount(status);
  }, 1);
}

/**
 * updateStage
 *
 * Update icon for only one stage
 */
this.updateStage = function () {
  STATES.forEach(function (state) {
    if (!self.currentActivities[state]) return;
    self.currentActivities[state].forEach(function (activity) {
      self.updateIcon(self.currentDeal, activity);
    });
  });
}

/**
 * updateIconOfAllDeals
 *
 * Update the icon of all deals whose an activity updated is among these activities
 * @param activity
 */
this.updateIconOfAllDeals = function (activity) {
  this.deals.forEach(function (deal) {
    if (deal._id === activity.lead || deal._id === activity.opp) {
      var stateFilter = self.stateFilter;
      var length = self.activities.length;

      // give a delay to update the icon compared to all these activities
      setTimeout(function () {
        self.setIcon(deal);
        if (!length && !isNaN(stateFilter) && deal.delayState !== stateFilter) {
          self.showPopover = null;
          return self.findStageAndCount(deal);
        }

        // Update the deal's icon compared to its activities
        self.activities.forEach(function (item) {
          if (item.opp === deal._id || item.lead === deal._id) self.updateIcon(deal, item);
          self.findStageAndCount(deal);
          // Hide the bubble if activity is finished and state has been changed with a state filter
          if (self.activities.indexOf(item) === length - 1 && deal.delayState !== stateFilter) self.showPopover = null;
        });
      }, 100);
    }
  });
}

/**
 * saveDoc
 *
 * Give a delay time to the doc-auto-edit to store the new document and update the pipeline visualization
 * @param deal
 */
this.saveDoc = function (doc) {
  this.currentDeal = !this.editDoc._id ? doc: this.editDoc;
  var id = this.currentDeal._id;
  this.triggerSave = this.triggerDelete = this.editMode = this.editDoc = null;

  // add a new activity
  if (doc.resource === 'core/activity' || this.resource === 'core/activity') {
    if (this.activities.indexOf(doc) === -1) this.activities.push(doc);
    return this.updateIconOfAllDeals(doc);
  }

  // Update current deal's icon
  this.setIcon(this.currentDeal);

  // Check if deal is already exist
  var alreadyExist = this.deals.every(function (deal) {
    return deal._id !== doc._id
  });

  // Add new deal in memory
  if (!alreadyExist) {
    doc.resource = this.resource;
    this.deals.push(doc);
  }

  // find the stage of the deals and count the amounts and deals
  this.findStageAndCount(doc);
  this.activities.forEach(function (activity) {
    if (id === activity.opp || id === activity.lead) self.updateIcon(self.currentDeal, activity);
  });
};

/**
 * editDeal
 *
 * Show a displayModal to edit a deal.
 * @param deal
 * @param event
 */
this.editDeal = function (deal, event) {
  if (/status/.test(event.target.className)) return;
  this.resource = deal.resource;
  this.editDoc = deal;
};

/**
 * Hide the popover if the user click outside.
 * @param event
 */
document.body.onmousedown = function (event) {
  if (/bubble/.test(event.target.className)) return;
  self.showPopover = null;
};

/**
 * Show the popover if the user click on the icon of deal's delay state.
 * @param event
 */
document.body.onmouseup = function (event) {
  if (/bubble/.test(event.target.className)) return;
  if (/status/.test(event.target.className)) self.showPopover = true;
  self.bubble = {
    top: event.pageY - event.offsetY + 28,
    left: event.pageX - event.offsetX - 16.5
  };
};

/**
 * Hide all during resize event.
 */
window.onresize = function () {
  self.hideAll();
}

this.currentActivities = {};

/**
 * showActivities
 *
 * Build and show the list of the activities of the current deal in the bubble.
 * @param deal
 */
this.showActivities = function (deal) {
  this.currentDeal = deal;
  this.currentActivities = {};

  // Define the deadline of the current deal compared to each of its activity
  this.activities.forEach(function (activity) {
    if (!activity.dueOn || activity.doneOn) return;
    if (activity.opp === deal._id || activity.lead === deal._id) {
      self.getDeadline(activity, activity.delaytime);

      // Activity will be stored among overdue activities
      if (activity.dueOn < self.today) {
        if (!self.currentActivities.overdue) self.currentActivities.overdue = [];
        self.currentActivities.overdue.push(activity);
        return self.sortBy('delaytime', self.currentActivities.overdue);
      }

      // Activity will be stored among scheduled activities
      if (!self.currentActivities.scheduled) self.currentActivities.scheduled = [];
      self.currentActivities.scheduled.push(activity);
      self.sortBy('delaytime', self.currentActivities.scheduled);
    }
  });
};

/**
 * createActivity
 *
 * Create a new activity by defining its lead or opp by using doc-auto-edit.
 */
this.createActivity = function () {
  this.resource = 'core/activity';
  if (this.currentDeal.resource === 'core/lead') return this.editDoc = { lead: this.currentDeal._id };
  this.editDoc = { opp: this.currentDeal._id };
};

/**
 * editActivity
 *
 * Edit an activity by using doc-auto-edit.
 * @param activity
 * @param event
 */
this.editActivity = function (activity, event) {
  if (/icon/.test(event.target.className)) return;
  this.resource = 'core/activity';
  this.editDoc = activity;
};

/**
 * doneActivity
 *
 * Make the activity to done when the user click on the icon-check of the activity.
 * @param activity
 */
this.doneActivity = function (activity) {

  // Activity is done today
  activity.doneOn = this.today;

  // change activity's status to completed
  activity.status = 5;

  // Remove useless to store
  delete activity.deadline;
  delete activity.delaytime;
  this.replaceData('core/activity', activity, function () {
    var index;

    // Remove activity among the current deal's activities
    STATES.forEach(function (state) {

      // May be the deal has not overdue or scheduled activities
      if (self.currentActivities[state]) {
        index = self.currentActivities[state].indexOf(activity);
        if (index !== -1) self.currentActivities[state].splice(index, 1);
      }
      if (STATES.indexOf(state) === STATES.length - 1) self.updateStage();
    });
    index = self.activities.indexOf(activity);
    self.activities.splice(index, 1);
    self.updateIconOfAllDeals(activity);
  });
};

/**
 * searchDeal
 *
 * Search deals with a specific keyword
 * @param keyword
 */
this.searchDeal = function (keyword) {
  var re = new RegExp(keyword, 'i');
  this.deals = this.allDeals.filter(function (deal) {
    return ((deal.desc && re.test(deal.desc)) || (deal.name && re.test(deal.name)));
  });
  this.stages.forEach(self.totalDealAndAmount);
};

/**
 * changeStateFilter
 *
 * Show only the specifics deals related to the state filter value.(overdue, not scheduled, today or greater than)
 * @param event
 */
this.changeStateFilter = function (event) {
  this.stateFilter = event.target.value.length < 2 ? parseInt(event.target.value) : event.target.value;
  this.stages.forEach(self.totalDealAndAmount);
};