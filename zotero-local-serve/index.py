
from flask import Flask, request, render_template
import os
import json
from datetime import datetime
import glob

app = Flask(__name__,
            static_folder="papers/")

@app.route("/")
def hello():
  return "Hello"
