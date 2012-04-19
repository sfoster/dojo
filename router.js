define([
	"dojo/aspect",
	"dojo/hash",
	"dojo/string",
	"dojo/topic"
], function(aspect, hash, string, topic){
	// Some references to things we'll need
	var routes = [],
		routeIndex = {},
		curPath;

	// Create a function to handle hash changes
	function handleHashChange(hash){
		var i, l, route, result;

		if (hash === curPath) { return; }
		curPath = hash;
		console.log("New hash:",curPath);

		// TODO: Properly pass parameters through
		for(i = 0, l = routes.length; i < l; ++i){
			route = routes[i];
			result = route.route.exec(curPath);

			if (result) {
				debugger;
				route.handler.apply(null, result.slice(1));
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
		if (typeof route == "string") {
			// Sub in based on IDs and splats
			route = route.replace(idMatch, idReplacement);
			route = route.replace(splatMatch, splatReplacement);
			// Make sure it's an exact match
			route = "^" + route + "$";

			// Hand it back
			return new RegExp(route);
		}
		return route;
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
	function noop(){ console.log("noop"); }

	var router = {
		add: function(args) {
			var index, exists, route, handle, removed;

			// Try to fetch the route if it already exists
			// This works thanks to stringifying of regex, woo
			index = routeIndex[args.route];
			exists = typeof index != "undefined";
			if (exists) { route = routes[index]; }

			// If we didn't get one, make a default start point
			if (!route) {
				route = {
					route: convertRouteToRegExp(args.route),
					handler: noop,
					count: 0
				};
			}

			// Set up our handler, forcing receiveArguments
			if (args.before) {
				handle = aspect.before(route, "handler", args.handler)
			} else {
				handle = aspect.after(route, "handler", args.handler, true);
			}
			route.count++;

			// If we don't have an index, put it into the index
			if (!exists) {
				index = routes.length;
				routeIndex[args.route] = index;
				routes.push(route);
			}

			// Useful in a moment to keep from re-removing routes
			removed = false;

			return {
				remove: function(){
					// Don't try to remove if we've already done so
					if (removed) { return; }

					// Remove the aspect and decrement the count
					handle.remove();
					route.count--;

					// If we're down to zero, cut and reindex
					if (route.count === 0) {
						routes.splice(index, 1);
						indexRoutes();
					}

					// Mark as removed
					removed = true;
				},
				add: function(handler) {
					return router.add({
						route: args.route,
						handler: handler
					});
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
		}
	};

	return router;
});
