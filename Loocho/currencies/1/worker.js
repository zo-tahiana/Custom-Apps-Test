//TODO: console.log will be replaced by logger.info and logger.error
console.log('worker of currencies app - fetching latest exchange rates');
var self = this;
self.getData('currencies/xrate', {}, function(err, data) {
  if (err) return console.log(err);
  var list = data.map(function(item) {
    return item && item.x;
  }).filter(function(item) {
    return item && item.length === 6;
  });
  var url = [
    'http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20yahoo.finance.xchange%20where%20pair%20in%20%28%22',
    list.join('%22,%20%22'),
    '%22%29&format=json&env=store://datatables.org/alltableswithkeys'
  ].join('');
  return request.get(url, { json: true }, function(err, response) {
    if (err) return console.log(err);
    //console.log('from Yahoo:', JSON.stringify(response.body, '', 2));
    var results = response && response.body && response.body.query && response.body.query.results &&
      response.body.query.results.rate || [];
    async.each(results, function(rate, cb) {
      var doc = _.find(data, { x: rate.id });
      if (!doc) return cb('Exchange symbol ' + rate.id + ' not found in database');
      doc.rate = rate.Rate;
      return self.replaceData('currencies/xrates', doc, cb);
    }, function(err) {
      if (err) return console.log(err);
      return console.log('worker of currencies app - all exchange rates have been updated')
    });
  });
});