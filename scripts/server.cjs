const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const url  = require('url');
const glob = require('glob');

const httpProxy = require('http-proxy');
const serveStatic = require('serve-static');
const translateURL = process.env.TRANSLATE_URL ?? 'http://localhost:1969';
const useHTTPS = !!(process.env.USE_HTTPS && parseInt(process.env.USE_HTTPS));
const port = process.env.PORT ?? (useHTTPS ? 8443 : 8001);

const serve = serveStatic(path.join(__dirname, '..', 'build'), { 'index': false });
const servePDFSlim = serveStatic("/Users/supasorn", { 'index': false });

const proxy = httpProxy.createProxyServer();
const zotero_storage_root = "/Users/supasorn/Zotero/storage";

const handler = (req, resp) => {
	const fallback = () => {
		fs.readFile(path.join(__dirname, '..', 'build', 'index.html'), (err, buf) => {
			resp.setHeader('Content-Type', 'text/html');
			resp.end(buf);
		});
	};
	if(req.url.startsWith('/static/fonts')) {
		proxy.web(req, resp, {
			changeOrigin: true,
			target: 'https://zotero.org/',
			followRedirects: true,
		});
		proxy.on('error', () => {
			resp.statusCode = 502;
			resp.statusMessage = 'Failed to proxy font files';
			resp.end();
		});
	} else if(req.url.startsWith('/web') || req.url.startsWith('/search') || req.url.startsWith('/export')) {
		proxy.web(req, resp, {
			changeOrigin: true,
			target: `${translateURL}`,
			secure: false
		});
		proxy.on('error', err => {
			resp.statusCode = 502;
			resp.statusMessage = `Translation Server not available at ${translateURL}: ${err}`;
			resp.end();
		});
	} else if (req.url.startsWith('/papers')) {
    let url_parts = url.parse(req.url);
    console.log(url_parts);
    let path1 = path.parse(url_parts.path);
    const paper_id = path1.base;
    console.log(path1);
    console.log(paper_id);
    
    if (path1.ext == ".pdf") {
      let pdffile = decodeURIComponent(`${zotero_storage_root}/${path1.dir.replace("/papers/", "")}/${path1.base}`);
      resp.writeHead(200, {"Content-Type": "application/pdf"});
      fs.readFile(pdffile, (err,data) => {
        if (err) {
          resp.json = {'status':'error', msg:err};
        } else {			
          resp.write(data);
          resp.end();       
        }
      });
    } else {
      glob(`${zotero_storage_root}/${paper_id}/*.pdf`, {}, (err, files)=>{
        if (err) {
          resp.json({'status':'error',msg:err});
        } else {
          // encodeURIComponent
          console.log(files)
          pdffile = path.parse(files[0]).base;
          resp.writeHead(302, {
            'Location': `${paper_id}/${pdffile}`
          });
          resp.end();
          
        }
      });
    }
  } else if (req.url.startsWith('/pdf_slim_viewer')) {
    servePDFSlim(req, resp, fallback);
  } else if (req.url.startsWith('/slim_view')) {
    let url_parts = url.parse(req.url);
    console.log(url_parts);
    let path1 = path.parse(url_parts.path);
    const paper_id = path1.base;

    glob(`${zotero_storage_root}/${paper_id}/*.pdf`, {}, (err, files)=>{
      if (err) {
        resp.json({'status':'error',msg:err});
      } else {
        // encodeURIComponent
        console.log(files)
        pdffile = path.parse(files[0]).base;
        resp.writeHead(302, {
          'Location': `/pdf_slim_viewer/web/viewer.html?file=http:/papers/${paper_id}/${pdffile}`
        });
        resp.end();

      }
    });

  } else {
		serve(req, resp, fallback);
	}
};

if(useHTTPS) {
	const options = {
		key: fs.readFileSync(path.join(__dirname, '..', 'cert', 'web-library.key')),
		cert: fs.readFileSync(path.join(__dirname, '..', 'cert', 'web-library.crt'))
	};

	https.createServer(options, handler).listen(port, () => {
		console.log(`>>> Listening on https://0.0.0.0:${port}/\n`);
	});
} else {
	http.createServer(handler).listen(port, () => {
		console.log(`>>> Listening on http://0.0.0.0:${port}/\n`);
	});
}
