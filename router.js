define([
	"dojo/aspect",
	"dojo/hash",
	"dojo/string",
	"dojo/topic"
], function(aspect, hash, string, topic){

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
		curPath;

	function handleHashChange(hash){
		var i, j, li, lj, routeObj, result, parameterNames, callbackObj;

		if (!started) { return; }
		if (hash === curPath) { return; }

		curPath = hash;

		for(i = 0, li = routes.length; i < li; ++i){
			routeObj = routes[i];
			result = routeObj.route.exec(curPath);

			if (result) {
				if (routeObj.parameterNames) {
					parameterNames = routeObj.parameterNames;
					callbackObj = {};

					for (j = 0, lj = parameterNames.length; j < lj; ++j) {
						callbackObj[parameterNames[j]] = result[j+1];
					}
				} else {
					callbackObj = result.slice(1);
				}
				routeObj.callback(callbackObj);
			}
		}
	}

	// A few pieces to handle converting string routes to regex
	var idMatch = /:(\w[\w\d]*)/g,
		idReplacement = "([^\\/]+)",
		splatMatch = /\*(\w[\w\d]*)/,
		splatReplacement = "(.+)";

	function convertRouteToRegExp(route){
		// Sub in based on IDs and splats
		route = route.replace(idMatch, idReplacement);
		route = route.replace(splatMatch, splatReplacement);
		// Make sure it's an exact match
		route = "^" + route + "$";

		// Hand it back
		return new RegExp(route);
	}

	function getParameterNames(route){
		var parameterNames = [], match;

		idMatch.lastIndex = 0;

		while ((match = idMatch.exec(route)) !== null) {
			parameterNames.push(match[1]);
		}
		if ((match = splatMatch.exec(route)) !== null) {
			parameterNames.push(match[1]);
		}

		return parameterNames.length > 0 ? parameterNames : null;
	}

	function indexRoutes(){
		var i, l, route;

		// Reset our route index
		routeIndex = {};

		// Set it up again
		for (i = 0, l = routes.length; i < l; ++i){
			route = routes[i];
			routeIndex[route.route] = i;
		}
	}

	// A simple empty function to give us an aspecting hook
	function noop(){}

	var router = {
		register: function(/* String|RegExp */ route, /* Function */ callback, /* Boolean? */ isBefore) {
			//	summary:
			//		Registers a route to a handling callback
			//
			//	description:
			//		Given either a string or a regular expression, the router
			//		will monitor the page's hash and respond to changes that
			//		match the string or regex as provided.
			//
			//		- If a regex is provided, the callback will receive an
			//		array of the groups in the match
			//
			//		- If a string is provided, it will be parsed for any
			//		values that look like a URL structure, and anything
			//		prefixed with a colon (:) will be turned into a named
			//		parameter that will show up on the object provided to the
			//		callback.
			//
			//	returns:
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
			//	isBefore: Boolean?
			//		If `isBefore` is true, then the callback will be set up to
			//		fire before any prior registered callbacks on that same
			//		route. By default, new callbacks bound to the same route
			//		will fire in sequence of registration.

			var index, exists, routeObj, handle, removed;

			// Try to fetch the route if it already exists
			// This works thanks to stringifying of regex
			index = routeIndex[route];
			exists = typeof index !== "undefined";
			if (exists) { routeObj = routes[index]; }

			// If we didn't get one, make a default start point
			if (!routeObj) {
				routeObj = {
					route: route,
					callback: noop,
					count: 0
				};
			}

			if (typeof route === "string") {
				routeObj.parameterNames = getParameterNames(route);
				routeObj.route = convertRouteToRegExp(route);
			}


			if (isBefore) {
				handle = aspect.before(routeObj, "callback", callback);
			} else {
				handle = aspect.after(routeObj, "callback", callback, true);
			}
			routeObj.count++;

			if (!exists) {
				index = routes.length;
				routeIndex[route] = index;
				routes.push(routeObj);
			}

			// Useful in a moment to keep from re-removing routes
			removed = false;

			return { // return Object
				remove: function(){
					if (removed) { return; }

					handle.remove();
					routeObj.count--;

					if (routeObj.count === 0) {
						routes.splice(index, 1);
						indexRoutes();
					}

					removed = true;
				},
				register: function(callback, isBefore) {
					return router.register(route, callback, isBefore);
				}
			};
		},

		go: function(path, replace){
			//	summary:
			//		A simple pass-through to make changing the hash easy,
			//		without having to require dojo/hash directly. It also
			//		synchronously fires off any routes that match.
			//	example:
			//	|	router.go("/foo/bar");

			path = string.trim(path);
			hash(path, replace);
			handleHashChange(path);
		},

		startup: function(){
			//	summary:
			//		This method must be called to activate the router. Until
			//		startup is called, no hash changes will trigger route
			//		callbacks. In the future, it may also allow for some
			//		initialization parameters.

			if (started) { return; }

			started = true;
			handleHashChange(hash());
			topic.subscribe("/dojo/hashchange", handleHashChange);
		}
	};

	return router;
});
