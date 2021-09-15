import {createServer, IncomingMessage, ServerResponse} from 'http';

export const start = () => {
  const server = createServer((_request: IncomingMessage, response: ServerResponse) => {
    response.end(JSON.stringify({status: true, online: true, message: 'Radinho 2.0 is running!'}));
  });

  const port = process.env.PORT ?? 5000;

  server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
};
