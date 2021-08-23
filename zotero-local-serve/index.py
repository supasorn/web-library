from flask import Flask, request, render_template, make_response, redirect, url_for
from flask_cors import CORS
import os
import json
from datetime import datetime
import glob
from pdf2image import convert_from_path
import cv2 as cv
import numpy as np

app = Flask(__name__,
            static_folder="data/")
CORS(app)


def pdf2jpg(f, subpath, prefix, dpi):
  images = convert_from_path(f, dpi=dpi, jpegopt={
    "quality": 100,
    "progressive": True,
    "optimize": True
  }, fmt='jpeg')
  for i, img in enumerate(images):
    img.save("data/" + subpath + "/paper_%s%02d.jpg" % (prefix, i), quality=95)
    print(img)

@app.route("/paper/<path:subpath>/<unused>")
def getPaper2(subpath, unused):
  f = glob.glob("/Users/supasorn/Zotero/storage/" + subpath + "/*.pdf")
  if len(f) > 0:
    fi = open(f[0], "rb")
    binary_pdf = fi.read()
    response = make_response(binary_pdf)
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = \
        'inline; filename=Yay it workds'
    return response
  return "yes"

@app.route("/paper/<path:subpath>")
def getPaper(subpath):
  f = glob.glob("/Users/supasorn/Zotero/storage/" + subpath + "/*.pdf")
  if len(f) > 0:
    return redirect('/paper/' + subpath + "/" + "".join(os.path.basename(f[0]).split("-")[2:]))

def findBoundary(img_t, axis):
  col = np.sum(img_t, axis) > 0
  ind = col * np.arange(1, col.shape[0]+1)

  mx = np.max(ind)
  ind[ind == 0] = 5000
  mn = np.min(ind)
  return mn, mx

@app.route("/test/<path:subpath>")
def crop(subpath):
  pdf = glob.glob("/Users/supasorn/Zotero/storage/" + subpath + "/*.pdf")
  if len(pdf) == 0:
    return "no pdf"
  pdf = pdf[0]

  images = convert_from_path(pdf, dpi=150, jpegopt={
    "quality": 100,
    "progressive": True,
    "optimize": True
  }, fmt='jpeg')

  lst = []
  mind = 1e5
  for i, img in enumerate(images):
    img = np.array(img)

    _, img_t = cv.threshold(img[:, :, 0], 220, 255, cv.THRESH_BINARY_INV)

    cmn, cmx = findBoundary(img_t, 0)
    rmn, rmx = findBoundary(img_t, 1)
    lst.append((rmn, rmx, cmn, cmx))

    cd = cmx - cmn
    rd = rmx - rmn
    if cd < mind: mind = cd
    if rd < mind: mind = rd


  margin = int(mind * 0.03)

  lstc = 0
  for i, img in enumerate(images):
    img = np.array(img)

    rmn, rmx, cmn, cmx = lst[i]
    rmn = np.clip(rmn - margin, 0, img.shape[0]-1)
    rmx = np.clip(rmx + margin, 0, img.shape[0]-1)
    cmn = np.clip(cmn - margin, 0, img.shape[1]-1)
    cmx = np.clip(cmx + margin, 0, img.shape[1]-1)

    newimg = img[rmn:rmx, cmn:cmx]
    cv.imwrite("data/" + subpath + "/paper_m%02d_cropped.jpg" % i, cv.cvtColor(newimg, cv.COLOR_RGB2BGR))

  return "ok"




@app.route("/")
def hello():
  return "Hello"

def loadTemplate(f="main.html"):
  with open(f, "r") as f:
    return f.read()

def repTem(template, tag, st):
  return template.replace("{" + tag + "}", st)

@app.route("/thumb/<path:subpath>")
def getthumb(subpath, methods=['GET']):
  pdf = glob.glob("/Users/supasorn/Zotero/storage/" + subpath + "/*.pdf")
  if len(pdf) == 0:
    return "no pdf"
  pdf = pdf[0]

  if not os.path.exists("data/" + subpath):
    os.mkdir("data/" + subpath)
    pdf2jpg(pdf, subpath, "m", 150)
    pdf2jpg(pdf, subpath, "s", 80)


  base = "http://localhost:5000"
  out = outm = ""
  # pages = sorted(glob.glob("data/" + subpath + "/paper_s*_cropped.jpg"))
  pages_m = sorted(glob.glob("data/" + subpath + "/paper_m*_cropped.jpg"))
  if len(pages_m) == 0:
    crop(subpath)
    pages_m = sorted(glob.glob("data/" + subpath + "/paper_m*_cropped.jpg"))

  # for page in pages:
    # out += f"<img height='180px' class='paper_page' src='{base}/{page}'>"

  for page in pages_m:
    outm += f"<img height='1300px' class='paper_page' src='{base}/{page}'>"

  template = loadTemplate("paper.html")
  template = repTem(template, "SMALL", out)
  template = repTem(template, "MEDIUM", outm)

  if request.args.get('script') is not None:
    template = repTem(template, "SCRIPT", '<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>')
  else:
    template = repTem(template, "SCRIPT", "")

  return template
