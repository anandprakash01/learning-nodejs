require("./src/01_os_module");
require("./src/02_fs_module");
require("./src/03_event_module");
require("./src/04_http_module");

// require("./src/app") :
// 1. Resolves file path
// 2. Wraps file in function:
//    (function(exports, require, module, __filename, __dirname) { ... })
// 3. Executes it
// 4. Caches result in require.cache
