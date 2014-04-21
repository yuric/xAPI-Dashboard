"use strict";

(function(ADL){

	var XAPIDashboard = function(){
		this.statements = new ADL.Collection();
	}

	XAPIDashboard.prototype.fetchAllStatements = function(query, wrapper, cb){
		var self = this;
		if( !wrapper || typeof(wrapper) === 'function' ){
			if(typeof(wrapper) === 'function' && !cb)
				cb = wrapper;
			wrapper = ADL.XAPIWrapper;
		}

		wrapper.getStatements(query, null, function getMore(r){
			var response = JSON.parse(r.response);
			self.addStatements(response.statements);
			
			if(response.more){
				wrapper.getStatements(null, response.more, getMore);
			}
			
			else if(cb){
				cb();
			}
		});
	};
	
	XAPIDashboard.prototype.clearSavedStatements = function(){
		this.contents = new Collection();
	};
	
	XAPIDashboard.prototype.addStatements = function(statementsArr){
		if(statementsArr.response){
			try{
				statementsArr = JSON.parse(statementsArr.response).statements;
			}
			catch(e){
				console.error("Error parsing JSON data", statementsArr.response);
				return;
			}
		}

		// pre-transform timestamps
		var newStatements = new ADL.Collection(statementsArr).transform(function(e){
			e.timestamp = new Date(Date.parse(e.timestamp));
			e.stored = new Date(Date.parse(e.stored));
			return e;
		});
		this.statements = this.statements.union( newStatements );
	};
	
	// default aggregator requires opts.groupField
	// opts.aggregate, opts.pre, opts.post, opts.customize are optional functions
	XAPIDashboard.prototype.genLineGraph = function(container, opts){
	
		var data = this.statements;
		if(opts.pre)
			data = opts.pre(data);

		data = (opts.aggregate ? opts.aggregate : XAPIDashboard.accumulate)(data, opts);

		if(opts.post)
			data = opts.post(data);

		nv.addGraph(function(){
			var chart = nv.models.lineChart()
				.options({
					'x': function(d,i){ return d.in; },
					'y': function(d,i){ return d.out; },
					'showXAxis': true,
					'showYAxis': true,
					'transitionDuration': 250
				});

			if(opts.customize)
				opts.customize(chart);

			d3.select(container)
				.datum([{'values': data.contents}])
				.call(chart);

  			nv.utils.windowResize(chart.update);
			return chart;
		});
	};
	
	// default aggregator requires opts.xField
	// opts.aggregate, opts.pre, opts.post, opts.customize are optional functions
	XAPIDashboard.prototype.genBarGraph = function(container, opts){
		var data = this.statements;
		if(opts.pre)
			data = opts.pre(data);

		data = (opts.aggregate ? opts.aggregate : XAPIDashboard.count)(data, opts);

		if(opts.post)
			data = opts.post(data);

		nv.addGraph(function(){
			var chart = nv.models.discreteBarChart()
				.x(function(d){ return d.in; })
				.y(function(d){ return d.out; })
				.staggerLabels(true)
				.transitionDuration(250);

			if( opts.customize )
				opts.customize(chart);

			d3.select(container)
				.datum([{
					'values': data.contents}])
				.call(chart);
			
			nv.utils.windowResize(chart.update);
			return chart;
		});
	};
	
	/*
	 * Class methods to perform graph "formatting" operations
	 */
	 
	XAPIDashboard.count = function(statements, opts){
		return statements.groupBy(opts.groupField, function(groupSet){ return groupSet.count(); });
	};	 

	XAPIDashboard.accumulate = function(statements, opts){
		return statements.transform(function(elem,index,array){
			return {
				'in': ADL.Collection.getValue(opts.xField)(elem),
				'out': opts.yField ? statements.select(ADL.Collection.first(index+1)).sum(opts.yField) : index+1,
				'sample': elem
			};
		});
	};
	
	XAPIDashboard.countRange = function(statements, opts){
		var rangeArr = ADL.Collection.genRange(opts.range.start, opts.range.end, opts.range.increment);
		return statements.groupByRange(opts.groupField, rangeArr, function(groupSet, start, end){ 
			return groupSet.count()
		});
	};	 	
	
	XAPIDashboard.average = function(statements, opts){
		var rangeArr = ADL.Collection.genRange(opts.range.start, opts.range.end, opts.range.increment);
		return statements.groupByRange(opts.groupField, rangeArr, function(groupSet, start, end){ 
			return groupSet.count() / opts.range.unit;
		});
	};	 
	
	
	
	ADL.XAPIDashboard = XAPIDashboard;

})(window.ADL = window.ADL || {});