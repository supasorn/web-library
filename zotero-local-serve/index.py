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

@app.route("/test/<path:subpath>")
def crop(subpath):
  pdf = glob.glob("/Users/supasorn/Zotero/storage/" + subpath + "/*.pdf")
  if len(pdf) == 0:
    return "no pdf"
  pdf = pdf[0]

  pages = sorted(glob.glob("data/" + subpath + "/paper_s*.jpg"))
  for page in pages:
    img = cv.imread(page, cv.IMREAD_GRAYSCALE)
    _, img_t = cv.threshold(img, 220, 255, cv.THRESH_BINARY_INV)
    col = np.sum(img_t, 0) > 0
    ind = col * np.arange(1, col.shape[0]+1)
    print(np.min(ind), np.max(ind))
    # cv.imwrite("test.jpg", img_t)
    # return "done"
    # print(img_t)

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
def getthumb(subpath):
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
  pages = sorted(glob.glob("data/" + subpath + "/paper_s*.jpg"))
  pages_m = sorted(glob.glob("data/" + subpath + "/paper_m*.jpg"))
  for page in pages:
    out += f"<img width='220px' class='paper_page' src='{base}/{page}'>"

  for page in pages_m:
    outm += f"<img width='900px' class='paper_page' src='{base}/{page}'>"

  template = loadTemplate("paper.html")
  template = repTem(template, "SMALL", out)
  template = repTem(template, "MEDIUM", outm)
  return template
