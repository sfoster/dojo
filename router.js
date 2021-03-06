define([
	"dojo/aspect",
	"dojo/has",
	"dojo/hash",
	"dojo/topic"
], function(aspect, has, hash, topic){

	//	module:
	//		dojo/router
	//	summary:
	//		A module that allows one to easily map hash-based structures into
	//		callbacks. The router module is a class, configured by default to listen for events
	//		on dojo/hash's /dojo/hashchange topic
	//	example:
	//	|	var router = new Router()
	//	|	router.register("/widgets/:id", function(params) {
	//	|		// If "/widgets/3" was matched,
	//	|		// params.id === "3"
	//	|		xhr.get({
	//	|			url: "/some/path/" + params.id,
	//	|			load: function(data) {
	//	|				// ...
	//	|			}
	//	|		});
	//	|	});

	var isDebug = has("config-isDebug");
	
	function Router(){
		var routes = this._routes = [],
			routeIndex = this._index = {};

		this.register.before = bind(this, "registerBefore");
	}
	
	Router.prototype.curPath = "";
	Router.prototype.started = false;
	Router.prototype.changeTopic = "/dojo/hashchange";
	
	Router.prototype.handleHashChange = function(hash){
		var i, j, li, lj, routeObj, result, parameterNames, callbackObj;
		var routes = this._routes;

		if(!this.started || hash === this.curPath){ return; }

		this.curPath = hash;

		for(i=0, li=routes.length; i<li; ++i){
			routeObj = routes[i];
			result = routeObj.route.exec(this.curPath);

			if(result){
				if(routeObj.parameterNames){
					parameterNames = routeObj.parameterNames;
					callbackObj = {};

					for(j=0, lj=parameterNames.length; j<lj; ++j){
						callbackObj[parameterNames[j]] = result[j+1];
					}
				}else{
					callbackObj = result.slice(1);
				}
				routeObj.callback(callbackObj);
			}
		}
	};

	// Creating a basic trim to avoid needing the full dojo/string module
	// similarly to dojo/_base/lang's trim
	var trim;
	if(String.prototype.trim){
		trim = function(str){ return str.trim(); };
	} else {
		trim = function(str){ return str.replace(/^\s\s*/, '').replace(/\s\s*$/, ''); };
	}

	// A simple empty function to give us an aspecting hook
	function noop(){}

	// inline 'hitch'-alike
	function bind(obj, method){
		return function(){
			return ('function'===typeof method ? method : obj[method]).apply(obj, arguments);
		};
	}
	
	// A few pieces to handle converting string routes to regex
	var idMatch = /:(\w[\w\d]*)/g,
	    idReplacement = "([^\\/]+)",
	    globMatch = /\*(\w[\w\d]*)/,
	    globReplacement = "(.+)";

	function convertRouteToRegExp(route){
		// Sub in based on IDs and globs
		route = route.replace(idMatch, idReplacement);
		route = route.replace(globMatch, globReplacement);
		// Make sure it's an exact match
		route = "^" + route + "$";

		return new RegExp(route);
	}

	function getParameterNames(route){
		var parameterNames = [], match;

		idMatch.lastIndex = 0;

		while((match = idMatch.exec(route)) !== null){
			parameterNames.push(match[1]);
		}
		if((match = globMatch.exec(route)) !== null){
			parameterNames.push(match[1]);
		}

		return parameterNames.length > 0 ? parameterNames : null;
	}

	Router.prototype.indexRoutes = function(){
		var i, l, route, routes = this._routes;

		// Reset our route index
		var routeIndex = this._index = {};

		// Set it up again
		for(i=0, l=routes.length; i<l; ++i){
			route = routes[i];
			routeIndex[route.route] = i;
		}

	};

	Router.prototype.registerRoute = function(/*String|RegExp*/route, /*Function*/callback, /*Boolean?*/isBefore){
		var index, exists, routeObj, handle, removed, 
				routes = this._routes;
		var router = this;
		
		// Try to fetch the route if it already exists.
		// This works thanks to stringifying of regex
		index = this._index[route];
		exists = typeof index !== "undefined";
		if(exists){ routeObj = routes[index]; }

		// If we didn't get one, make a default start point
		if(!routeObj){
			routeObj = {
				route: route,
				callback: noop,
				count: 0
			};
		}

		if(typeof route == "string"){
			routeObj.parameterNames = getParameterNames(route);
			routeObj.route = convertRouteToRegExp(route);
		}


		if(isBefore){
			handle = aspect.before(routeObj, "callback", callback);
		} else {
			handle = aspect.after(routeObj, "callback", callback, true);
		}
		routeObj.count++;

		if(!exists){
			index = routes.length;
			this._index[route] = index;
			routes.push(routeObj);
		}

		// Useful in a moment to keep from re-removing routes
		removed = false;

		return { // Object
			remove: function(){
				if(removed){ return; }

				handle.remove();
				routeObj.count--;

				if(routeObj.count === 0){
					routes.splice(index, 1);
					router.indexRoutes();
				}

				removed = true;
			},
			register: function(callback, isBefore){
				return router.register(route, callback, isBefore);
			}
		};
	};

	Router.prototype.register = function(/*String|RegExp*/ route, /*Function*/ callback){
		//	summary:
		//		Registers a route to a handling callback
		//
		//	description:
		//		Given either a string or a regular expression, the router
		//		will monitor the page's hash and respond to changes that
		//		match the string or regex as provided.
		//
		//		When provided a regex for the route:
		//		- Matching is performed, and the resulting capture groups
		//		are passed through to the callback as an array.
		//
		//		When provided a string for the route:
		//		- The string is parsed as a URL-like structure, like
		//		"/foo/bar"
		//		- If any portions of that URL are prefixed with a colon
		//		(:), they will be parsed out and provided to the callback
		//		as properties of an object.
		//		- If the last piece of the URL-like structure is prefixed
		//		with a star (*) instead of a colon, it will be replaced in
		//		the resulting regex with a greedy (.+) match and
		//		anything remaining on the hash will be provided as a
		//		property on the object passed into the callback. Think of
		//		it like a basic means of globbing the end of a route.
		//
		//	example:
		//	|	router.register("/foo/:bar/*baz", function(object) {
		//	|		// If the hash was "/foo/abc/def/ghi",
		//	|		// object.bar === "abc"
		//	|		// object.baz === "def/ghi"
		//	|	});
		//
		//	returns: Object
		//		A plain JavaScript object to be used as a handle for
		//		either removing this specific callback's registration, as
		//		well as to add new callbacks with the same route initially
		//		used.
		//
		//	route: String | RegExp
		//		A string or regular expression which will be used when
		//		monitoring hash changes.
		//	callback: Function
		//		When the hash matches a pattern as described in the route,
		//		this callback will be executed. It will receive either an
		//		array or an object, depending on the route.

		return this.registerRoute(route, callback);
	};

	Router.prototype.go = function(path, replace){
		//	summary:
		//		A simple pass-through to make changing the hash easy,
		//		without having to require dojo/hash directly. It also
		//		synchronously fires off any routes that match.
		//	example:
		//	|	router.go("/foo/bar");

		path = trim(path);
		hash(path, replace);
		this.handleHashChange(path);
	};

	Router.prototype.startup = function(){
		//	summary:
		//		This method must be called to activate the router. Until
		//		startup is called, no hash changes will trigger route
		//		callbacks.

		if(this.started){ return; }
		this.started = true;

		// use initial value of curPath to initialize, if one has been set
		this.handleHashChange( this.hasOwnProperty("curPath") || hash() );

		topic.subscribe( this.changeTopic, bind(this, "handleHashChange"));
	};

	Router.prototype.registerBefore = function(/*String|RegExp*/ route, /*Function*/ callback){
		//	summary:
		//		Registers a route to a handling callback, but the registered
		//		callback fires before other previously defined callbacks. See
		//		router.register for more details.

		return this.registerRoute(route, callback, true);
	};

	// if(isDebug){
	//	router._routes = routes;
	//	router._index = routeIndex;
	//	router._hash = hash;
	// }
	
	return Router;
});
