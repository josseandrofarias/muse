import {createServer, IncomingMessage, ServerResponse} from 'http';

export const start = () => {
  const server = createServer((_request: IncomingMessage, response: ServerResponse) => {
    response.end('Hello world!');
  });

  const port = process.env.PORT ?? 5000;

  server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
};
