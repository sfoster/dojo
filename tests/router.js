define(["doh", "../hash", "../router"], function(doh, hash, router){
	var count = 0,
		handle, foo;

	doh.register("tests.router", [
		{
			name: "Router API",
			runTest: function(t) {
				t.t(router.register, "Router doesn't have a register");
				t.t(router.go, "Router doesn't have a go");
				t.t(router.startup, "Router doesn't have a startup");
			}
		},
		{
			name: "Registering a route by string",
			runTest: function(t) {
				handle = router.register("/foo", function(){
					count++;
					console.log("/foo fired! New count:", count);
				});

				// Make sure it looks right
				t.t(handle.remove, "Handle doesn't have a remove");
				t.t(handle.register, "Handle doesn't have a register");
			}
		},
		{
			name: "Ensuring routes don't fire before startup",
			setUp: function() {
				count = 0;
			},
			runTest: function(t) {
				hash("/foo");
				t.t(count === 0, "Count should have been 0, was " + count);
			}
		},
		{
			name: "Ensuring routes do fire after startup",
			runTest: function(t) {
				router.startup();
				t.t(count === 1, "Count should have been 1, was " + count);
			}
		},
		{
			name: "Ensuring that hash changes fire routes",
			runTest: function(t) {
				// Due to the nature of the hashchange event,
				// these tests are going to be async - but we have to nest it,
				// sadly.

				var d = new doh.Deferred();

				// Reset the hash
				hash("");

				setTimeout(function(){
					// As soon as possible, set it back to our test...
					hash("/foo");

					// ... and then check to make sure the events fired
					setTimeout(d.getTestCallback(function(){
						t.t(count === 2, "Count should have been 2, was " + count);
					}), 50);
				}, 0);

				return d;
			}
		},
		{
			name: "Ensuring that router.go fires changes",
			runTest: function(t) {
				var d = new doh.Deferred();

				hash("");

				setTimeout(function(){
					router.go("/foo");

					setTimeout(d.getTestCallback(function(){
						t.t(count === 3, "Count should have been 3, was " + count);
					}), 50);
				}, 0);

				return d;
			}
		},
		{
			name: "Ensuring route doesn't fire after removal",
			runTest: function(t) {
				var d = new doh.Deferred();

				handle.remove();

				hash("");

				setTimeout(function(){
					router.go("/foo");

					setTimeout(d.getTestCallback(function(){
						t.t(count === 3, "Count should have been 3, was " + count);
					}), 50);
				}, 0);

				return d;
			}
		},
		{
			name: "Registering a route by regexp",
			runTest: function(t) {
				var d = new doh.Deferred();

				router.register(/^\/bar$/, function() {
					count++;
				});
				router.go("/bar");

				setTimeout(d.getTestCallback(function(){
					t.t(count === 4, "Count should have been 4, was " + count);
				}), 50);

				return d;
			}
		},
		{
			name: "Registering more complex routes",
			runTest: function(t) {
				var d = new doh.Deferred();

				return d;
			}
		}
	]);
});
