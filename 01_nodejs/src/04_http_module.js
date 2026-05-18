// The http module is not written in JavaScript. It is a highly optimized C++ library embedded inside the Node.js binary (specifically, it uses a C utility called llhttp to parse network headers).
const http = require("http");

const {StringDecoder} = require("string_decoder");

// 1. Import the frozen, validated memory object
const env = require("../config/env");

// A TCP (Transmission Control Protocol) Server is fundamentally a long-running software process that binds itself to a specific physical hardware port (like Port 3000) on a machine and listens passively for incoming network connections from clients.

// Unlike a UDP connection, which just fires data blindly into the void, TCP is stateful, reliable, and stream-oriented.
// When you start a TCP server, it asks the Operating System (Linux, Windows, macOS) to open a "Socket." A socket is simply an endpoint defined by an IP Address and a Port Number (e.g., 192.168.1.5:3000). Once bound, the OS routes all electrical signals arriving at that specific hardware port directly to your V8 Node.js process.

// Sample JSON data
const sampleData = [
  {name: "Captain America", id: 1},
  {name: "Iron Man", id: 2},
  {name: "Dr. Strange", id: 3},
];
const sampleDataString = JSON.stringify(sampleData);

const server = http.createServer((req, res) => {
  // This callback fires every time a user visits our port.

  // http.createServer(...): This creates an empty server object in your computer's memory. The function you pass inside (req, res) => {} is the Listener. Node.js puts this function to sleep. It only wakes up when someone actually types http://localhost:3000 in their browser.

  // The req (Request) Object: This represents the incoming data from the user. It contains the user's IP address, the URL they are trying to visit, and any data they are sending (like a login form).

  // The res (Response) Object: This represents the outgoing pipeline back to the user. You use this to send data back.

  // console.log(req);
  const currentUrl = req.url;
  const method = req.method;

  // Set the metadata (Headers) - response type to JSON
  res.setHeader("Content-Type", "application/json");

  if (method === "GET") {
    if (currentUrl === "/") {
      res.writeHead(200);
      return res.end(sampleDataString);
    } else if (currentUrl === "/users") {
      res.writeHead(200);
      return res.end(sampleDataString);
    } else {
      res.writeHead(404);
      return res.end(JSON.stringify({error: "Invalid URL"}));
    }
  } else if (method === "POST") {
    const decoder = new StringDecoder("utf-8");
    let bodyBuffer = "";
    // console.log(req.body);
    req.on("data", chunk => {
      bodyBuffer += chunk.toString();
      // bodyBuffer += decoder.write(chunk);
      if (bodyBuffer.length > 1e6) {
        console.error("Payload too large. Severing TCP connection.");
        res.writeHead(400);
        res.end(JSON.stringify({error: "Payload is too large"}));
        req.connection.destroy();
      }
    });
    console.log("body", bodyBuffer); //Empty string
    // When a user submits a form (POST request), the data does not arrive all at once. It arrives in microscopic TCP packets.

    // Because `req` inherits from `EventEmitter`, the hidden C++ libuv engine is constantly calling `req.emit('data', binaryChunk)` under the hood every time a packet arrives.

    // The "Mistake":
    // try to read `req.body` immediately. In pure Node.js, it doesn't exist yet. If you don't listen for the 'data' events, the stream is lost.

    // The "Enterprise Way":
    // We manually construct the memory buffer by intercepting those events. Once the 'end' event fires, we know the complete TCP payload has arrived, and we can safely parse it into JSON.

    if (currentUrl === "/users") {
      req.on("end", () => {
        const parsedData = JSON.parse(bodyBuffer || "{}");
        console.log(parsedData);

        res.writeHead(201);
        return res.end(JSON.stringify({message: "User created", data: parsedData}));
      });
      return; // Exit the main function while the async events process
    }

    res.writeHead(404);
    res.end(JSON.stringify({error: "Invalid Route."}));
  }

  // res.end(...): This is the most critical command. It tells the Node.js engine, "I am done talking to this user. Flush the data to their browser and close the network socket." If you forget to write res.end(), the user's browser will show a loading spinner forever until it eventually times out.
});

server.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});
