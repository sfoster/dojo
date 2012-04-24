define([
	"dojo/aspect",
	"dojo/hash",
	"dojo/string",
	"dojo/topic"
], function(aspect, hash, string, topic){
	// Some references to things we'll need
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
				routeObj.handler(callbackObj);
			}
		}
	}
	topic.subscribe("/dojo/hashchange", handleHashChange);

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

	// Build up our index
	function indexRoutes(){
		var i, l, route;

		// Reset our route index
		routeIndex = {};

		// Set it up again
		for (i = 0, l = routes.length; i < l; ++i){
			route = routes[i];
			routeIndex[route.route] = i;
		}

		// TODO: Remove later, here for debugging
		router._index = routeIndex;
	}

	// A simple empty function to give us an aspecting hook
	function noop(){}

	var router = {
		register: function(route, handler, isBefore) {
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
					handler: noop,
					count: 0
				};
			}

			if (typeof route === "string") {
				routeObj.parameterNames = getParameterNames(route);
				routeObj.route = convertRouteToRegExp(route);
			}


			if (isBefore) {
				handle = aspect.before(routeObj, "handler", handler);
			} else {
				handle = aspect.after(routeObj, "handler", handler, true);
			}
			routeObj.count++;

			if (!exists) {
				index = routes.length;
				routeIndex[route] = index;
				routes.push(routeObj);
			}

			// Useful in a moment to keep from re-removing routes
			removed = false;

			return {
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
				register: function(handler, isBefore) {
					return router.register(route, handler, isBefore);
				}
			};
		},

		// TODO: Remove these before live, useful for debugging
		_routes: routes,
		_index: routeIndex,
		_hash: hash,

		go: function(path, replace){
			path = string.trim(path);
			if (path.indexOf("/") !== 0) { path = "/" + path; }
			hash(path, replace);
		},

		startup: function(){
			if (started) { return; }

			started = true;
			handleHashChange(hash());
		}
	};

	return router;
});
