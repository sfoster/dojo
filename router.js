define([
	"dojo/has",
	"dojo/hash",
	"dojo/topic"
], function(has, hash, topic){

	//	module:
	//		dojo/router
	//	summary:
	//		A module that allows one to easily map hash-based structures into
	//		callbacks. The router module is a singleton, offering one central
	//		point for all registrations of this type.
	//	example:
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

	var routes = [],
	    routeIndex = {},
	    started = false,
	    isDebug = has("config-isDebug"),
	    currentPath = "";

	function handlePathChange(newPath){
		var i, j, li, lj, routeObj, result, allowChange, parameterNames, params;

		if(!started || newPath === currentPath){ return; }

		allowChange = true;

		for(i=0, li=routes.length; i<li; ++i){
			routeObj = routes[i];
			result = routeObj.route.exec(newPath);

			if(result){
				if(routeObj.parameterNames){
					parameterNames = routeObj.parameterNames;
					params = {};

					for(j=0, lj=parameterNames.length; j<lj; ++j){
						params[parameterNames[j]] = result[j+1];
					}
				}else{
					params = result.slice(1);
				}
				allowChange = routeObj.fire(params, currentPath, newPath);
			}
		}

		if (allowChange) {
			currentPath = newPath;
		}

		return allowChange;
	}

	// Creating a basic trim to avoid needing the full dojo/string module
	// similarly to dojo/_base/lang's trim
	var trim;
	if(String.prototype.trim){
		trim = function(str){ return str.trim(); };
	} else {
		trim = function(str){ return str.replace(/^\s\s*/, '').replace(/\s\s*$/, ''); };
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

	function indexRoutes(){
		var i, l, route;

		// Reset our route index
		routeIndex = {};

		// Set it up again
		for(i=0, l=routes.length; i<l; ++i){
			route = routes[i];
			routeIndex[route.route] = i;
		}

		if(isDebug){
			router._index = routeIndex;
		}
	}

	function fireRoute(params, currentPath, newPath){
		var queue, isStopped, isPrevented, eventObj, i, l;

		queue = this.callbackQueue;
		isStopped = false;
		isPrevented = false;
		eventObj = {
			stopImmediatePropagation: function(){ isStopped = true; },
			preventDefault: function(){ isPrevented = true; },
			oldPath: currentPath,
			newPath: newPath,
			params: params
		};

		for(i=0, l=queue.length; i<l; ++i){
			if (!isStopped) {
				queue[i](eventObj);
			}
		}

		return !isPrevented;
	}

	function registerRoute(/*String|RegExp*/route, /*Function*/callback, /*Boolean?*/isBefore){
		var index, exists, routeObj, callbackQueue, removed;

		// Try to fetch the route if it already exists.
		// This works thanks to stringifying of regex
		index = routeIndex[route];
		exists = typeof index !== "undefined";
		if(exists){
			routeObj = routes[index];
		}

		// If we didn't get one, make a default start point
		if(!routeObj){
			routeObj = {
				route: route,
				callbackQueue: [],
				fire: fireRoute
			};
		}

		callbackQueue = routeObj.callbackQueue;

		if(typeof route == "string"){
			routeObj.parameterNames = getParameterNames(route);
			routeObj.route = convertRouteToRegExp(route);
		}

		if(isBefore){
			callbackQueue.unshift(callback);
		} else {
			callbackQueue.push(callback);
		}

		if(!exists){
			index = routes.length;
			routeIndex[route] = index;
			routes.push(routeObj);
		}

		// Useful in a moment to keep from re-removing routes
		removed = false;

		return { // Object
			remove: function(){
				var i, l;

				if(removed){ return; }

				for(i=0, l=callbackQueue.length; i<l; ++i){
					if(callbackQueue[i] === callback){
						callbackQueue.splice(i, 1);
					}
				}


				if(callbackQueue.length === 0){
					routes.splice(index, 1);
					indexRoutes();
				}

				removed = true;
			},
			register: function(callback, isBefore){
				return router.register(route, callback, isBefore);
			}
		};
	}

	var router = {
		register: function(/*String|RegExp*/ route, /*Function*/ callback){
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
			//		this callback will be executed. It will receive an event
			//		object that will have several properties:
			//		- params: Either an array or object of properties pulled
			//		from the new hash
			//		- oldPath: The hash in its state before the change
			//		- newPath: The new hash being shifted to
			//		- preventDefault: A method that will stop hash changes
			//		from being actually applied to the active hash. This only
			//		works if the hash change was initiated using `router.go`,
			//		as changes initiated more directly to the location.hash
			//		property will already be in place
			//		- stopImmediatePropagation: When called, will stop any
			//		further bound callbacks on this particular route from
			//		being executed. If two distinct routes are bound that are
			//		different, but both happen to match the current hash in
			//		some way, this will *not* keep other routes from receiving
			//		notice of the change.

			return registerRoute(route, callback);
		},

		go: function(path, replace){
			//	summary:
			//		A simple pass-through to make changing the hash easy,
			//		without having to require dojo/hash directly. It also
			//		synchronously fires off any routes that match.
			//	example:
			//	|	router.go("/foo/bar");

			var applyChange;

			path = trim(path);
			applyChange = handlePathChange(path);

			if (applyChange) {
				hash(path, replace);
			}

			return applyChange;
		},

		startup: function(){
			//	summary:
			//		This method must be called to activate the router. Until
			//		startup is called, no hash changes will trigger route
			//		callbacks.

			if(started){ return; }

			started = true;
			handlePathChange(hash());
			topic.subscribe("/dojo/hashchange", handlePathChange);
		}
	};

	router.register.before = function(/*String|RegExp*/ route, /*Function*/ callback){
		//	summary:
		//		Registers a route to a handling callback, but the registered
		//		callback fires before other previously defined callbacks. See
		//		router.register for more details.

		return registerRoute(route, callback, true);
	};

	if(isDebug){
		router._routes = routes;
		router._index = routeIndex;
		router._hash = hash;
	}

	return router;
});
