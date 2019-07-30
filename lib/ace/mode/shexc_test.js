/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2010, Ajax.org B.V.
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Ajax.org B.V. nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * typical invocation: node lib/ace/mode/shexc_test.js
 * maintainer invocation: SCHEMAS=../shexTest/schemas/\*.shex node lib/ace/mode/shexc_test.js
 * SCHEMAS specified a path to positive syntax tests, like those in github.com:shexSpec/shexTest
 */

// Ace-native classes
const NS = "constant.library"
const RelIRI = "constant.language"
const INV = "invalid"

const Async = require("asyncjs")

if (typeof process !== "undefined") {
  require("amd-loader");
}

const assert = require("../test/assertions");
const EditSession = require("../edit_session").EditSession;
const ShExCMode = require("./shexc").Mode;

define(function(require, exports, module) {
  "use strict";

  const Tokenizer = require("../tokenizer").Tokenizer;

  module.exports = {
    toktst : function (state, strz, expectedToken, expectedState) {
      let tokens, tokenizer = this.mode.getTokenizer();
      assert.ok(tokenizer instanceof Tokenizer);
      strz.forEach(str => {
        const pair = tokenizer.getLineTokens(str, state);
        state = pair.state;
        tokens = pair.tokens;
      });
      // Make sure every expected token appears in the result.
      expectedToken.split(/\./).forEach(
        tok =>
          assert.ok(tokens[0].type.split(/\./).indexOf(tok) !== -1,
                    Error(expectedToken + " not found in " + tokens[0].type))
      )
      if (expectedState)
        assert.equal(typeof state === "string" ? state : state[0], expectedState)
    },

    setUp : function() {
      this.mode = new ShExCMode();
    },

    // tests are everything in exports whose key matches /^[>\!]?test/
    "test: start <- PrEfIx": function() { this.toktst("start", ["PrEfIx"], "keyword", "prefix_PNAME_NS"); },
    "test: shexDoc <- PrEfIx": function() { this.toktst("shexDoc", ["PrEfIx"], "keyword"); },
    "test: shexDoc !<- PrEfIx999": function() { this.toktst("shexDoc", ["PrEfIx999"], INV); },
    "test: PNAME_NS <- :": function() { this.toktst("prefix_PNAME_NS", [":"], NS); },
    "test: PNAME_NS <- a:": function() { this.toktst("prefix_PNAME_NS", ["a:"], NS); },
    "test: PNAME_NS !<- a": function() { this.toktst("prefix_PNAME_NS", ["a"], INV); },
    "test: PNAME_NS !<- <a>": function() { this.toktst("prefix_PNAME_NS", ["<a>"], INV); },
    "test: IRIREF <- <a>": function() { this.toktst("IRIREF", ["<a>"], RelIRI); },
    "test: start <- <a>": function() { this.toktst("start", ["<a>"], "shapeExprLabel"); },
    "test: start !<- <a>prefix": function() { this.toktst("start", ["<a>", "prefix"], INV); },
    "test: start <- <a> <a>": function() { this.toktst("start", ["<a>", " ", "<a>"], "datatype"); },
    "test: start <- <a> <a> <a>": function() { this.toktst("start", ["<a>", " ", "<a>", " ", "<a>"], "shapeExprLabel"); },
    "test: start <- <a><a>": function() { this.toktst("start", ["<a>", "<a>"], "datatype"); },
    "test: start <- <a><a><a>": function() { this.toktst("start", ["<a>", "<a>", "<a>"], "shapeExprLabel"); },
    "test: start <- a:": function() { this.toktst("start", ["a:"], "shapeExprLabel"); },
    "test: start <- a: a:": function() { this.toktst("start", ["a:", " ", "a:"], "datatype"); },
    "test: start <- a: a: a:": function() { this.toktst("start", ["a:", " ", "a:", " ", "a:"], "shapeExprLabel"); },
    "test: start <- prefix a:<a>a:": function() { this.toktst("IRIREF", ["prefix", " ", "a:", "<a>", "a:"], "shapeExprLabel"); },
    "test: start <- <a>{<a>": function() { this.toktst("start", ["<a>", "{", "<a>"], "predicate"); },
    "test: start <- <a>{<a>{<a>": function() { this.toktst("start", ["<a>", "{", "<a>", "{", "<a>"], "predicate"); },
    "test: start <- <a>{a": function() { this.toktst("start", ["<a>", "{", "a"], "predicate"); },
    "test: shapeNot <- IRI": function() { this.toktst("shapeNot", ["IRI"], "keyword"); },
    "test: shapeNot <- NOT IRI": function() { this.toktst("shapeNot", ["NOT", " ", "IRI"], "keyword"); },
    "test: shapeNot <- [": function() { this.toktst("shapeNot", ["["], "operator", "valueSet"); },
    "test: andOrOpt !<- )": function() { this.toktst("andOrOpt", [")"], INV); },
    "test: nested_andOrOpt <- )": function() { this.toktst("nested_andOrOpt", [")"], "rparen"); },
    "test: shapeNot <- IRI AND IRI": function() { this.toktst("shapeNot", ["IRI", "AND", "IRI"], "keyword"); },
    "test: shapeNot <- IRI AND NOT IRI": function() { this.toktst("shapeNot", ["IRI", "AND", "NOT", "IRI"], "keyword"); },
    "test: shapeNot <- IRI AND IRI IRI": function() { this.toktst("shapeNot", ["IRI", "AND", "IRI", "IRI"], INV); },
    "test: shapeNot <- IRI AND NOT {": function() { this.toktst("shapeNot", ["IRI", "AND", "NOT", "{"], "lcurly"); },

    "test: toggle comment lines should prepend '#' to each line" : function() {
      const session = new EditSession(["  abc", "cde", "fg"]);
      session.setTabSize(1);

      this.mode.toggleCommentLines("start", session, 0, 1);
      assert.equal(["#   abc", "# cde", "fg"].join("\n"), session.toString());
    },

    "test: toggle comment on commented lines should remove leading '#' chars" : function() {
      const session = new EditSession(["#  abc", "#cde", "fg"]);
      session.setTabSize(1);

      this.mode.toggleCommentLines("start", session, 0, 1);
      assert.equal([" abc", "cde", "fg"].join("\n"), session.toString());
    },

    "test: toggle comment on all empty lines" : function() {
      const session = new EditSession(["  ", " ", "  "]);
      session.setTabSize(1);

      this.mode.toggleCommentLines("start", session, 0, 1);
      assert.equal([" #  ", " # ", "  "].join("\n"), session.toString());
    },

    "test: toggle comment with empty lines" : function() {
      const session = new EditSession([
        "        abc",
        "",
        "    cde",
        "    fg"]);

      const initial = session.toString();
      this.mode.toggleCommentLines("start", session, 0, 3);
      assert.equal([
        "    #     abc",
        "",
        "    # cde",
        "    # fg"].join("\n"),
                   session.toString()
                  );
      this.mode.toggleCommentLines("start", session, 0, 3);
      assert.equal(initial, session.toString());
    },

    "test: toggle comment lines twice should return the original text" : function() {
      const session = new EditSession(["  abc", "cde", "fg"]);

      this.mode.toggleCommentLines("start", session, 0, 2);
      this.mode.toggleCommentLines("start", session, 0, 2);
      assert.equal(["  abc", "cde", "fg"].join("\n"), session.toString());
    },

    "test: toggle comment on multiple lines with one commented line prepend '#' to each line" : function() {
      const session = new EditSession(["  #  abc", "  #cde", "    fg"]);
      session.setTabSize(1);
      this.mode.toggleCommentLines("start", session, 0, 2);
      assert.equal(["  # #  abc", "  # #cde", "  #   fg"].join("\n"), session.toString());
    },

    "test: toggle comment on a comment line with leading white space": function() {
      const session = new EditSession(["#cde", "  #fg"]);

      this.mode.toggleCommentLines("start", session, 0, 1);
      assert.equal(["cde", "  fg"].join("\n"), session.toString());
    },

    "test: toggle comment lines should take tabsize into account" : function() {
      const session = new EditSession(["  #  abc", "  # cde", "#    fg"]);
      session.setTabSize(2);
      this.mode.toggleCommentLines("start", session, 0, 2);
      assert.equal(["    abc", "  cde", "    fg"].join("\n"), session.toString());
      session.setTabSize(4);
      this.mode.toggleCommentLines("start", session, 0, 2);
      assert.equal(["#     abc", "#   cde", "#     fg"].join("\n"), session.toString());
      this.mode.toggleCommentLines("start", session, 0, 2);
      assert.equal(["    abc", "  cde", "    fg"].join("\n"), session.toString());

      session.insert({row: 0, column: 0}, " ");
      this.mode.toggleCommentLines("start", session, 0, 2);
      assert.equal(["#      abc", "#   cde", "#     fg"].join("\n"), session.toString());
    },
    //there doesn't seem to be any way to make this work
    "test: togglecomment on line with one space" : function() {
      const session = new EditSession([" abc", "  # cde", "#    fg"]);
      const initialValue = session + "";
      session.setTabSize(4);
      this.mode.toggleCommentLines("start", session, 0, 0);
      this.mode.toggleCommentLines("start", session, 0, 0);
      assert.equal(initialValue, session.toString());
    },

    "test: auto indent after opening brace" : function() {
      assert.equal("  ", this.mode.getNextLineIndent("start", "<S> {", "  "));
    },

    "test: auto indent after case" : function() {
      assert.equal("  ", this.mode.getNextLineIndent("start", "case 'juhu':", "  "));
    },

    "test: no auto indent in object literal" : function() {
      assert.equal("", this.mode.getNextLineIndent("start", "{ 'juhu':", "  "));
    },

    "test: no auto indent after opening brace in multi line comment" : function() {
      assert.equal("", this.mode.getNextLineIndent("start", "/*<S> {", "  "));
      assert.equal("  ", this.mode.getNextLineIndent("comment", "  abcd", "  "));
    },

    "test: no auto indent after opening brace in single line comment" : function() {
      assert.equal("", this.mode.getNextLineIndent("start", "#<S> {", "  "));
      assert.equal("  ", this.mode.getNextLineIndent("start", "  #<S> {", "  "));
    },

    "test: no auto indent should add to existing indent" : function() {
      assert.equal("      ", this.mode.getNextLineIndent("start", "    <S> {", "  "));
      assert.equal("    ", this.mode.getNextLineIndent("start", "    cde", "  "));
      assert.equal("    ", this.mode.getNextLineIndent("start", "function foo(items) {", "    "));
    },

    "test: special indent in doc comments" : function() {
      assert.equal(" * ", this.mode.getNextLineIndent("doc-start", "/**", " "));
      assert.equal("   * ", this.mode.getNextLineIndent("doc-start", "  /**", " "));
      assert.equal(" * ", this.mode.getNextLineIndent("doc-start", " *", " "));
      assert.equal("    * ", this.mode.getNextLineIndent("doc-start", "    *", " "));
      assert.equal("  ", this.mode.getNextLineIndent("doc-start", "  abc", " "));
    },

    "test: indent three after doc comments" : function() {
      assert.equal("   ", this.mode.getNextLineIndent("comment0", "   */", "  "));
    },

    "test: trigger outdent if line is space and new text starts with closing brace" : function() {
      assert.ok(this.mode.checkOutdent("start", "   ", " }"));
      assert.ok(!this.mode.checkOutdent("start", " a  ", " }"));
      assert.ok(!this.mode.checkOutdent("start", "", "}"));
      assert.ok(!this.mode.checkOutdent("start", "   ", "a }"));
      assert.ok(!this.mode.checkOutdent("start", "   }", "}"));
    },

    "test: auto outdent should indent the line with the same indent as the line with the matching opening brace" : function() {
      const session = new EditSession(["  function foo() {", "    bla", "    }"], new ShExCMode());
      this.mode.autoOutdent("start", session, 2);
      assert.equal("  }", session.getLine(2));
    },

    "test: no auto outdent if no matching brace is found" : function() {
      const session = new EditSession(["  function foo()", "    bla", "    }"]);
      this.mode.autoOutdent("start", session, 2);
      assert.equal("    }", session.getLine(2));
    }
  };

});

if ("SCHEMAS" in process.env) {
  const skips = [] // empty means no skipped tests
  Async.glob(process.env["SCHEMAS"])
    .readFile("utf8")
    .each(function (file, next) {
      const testName = (skips.indexOf(file.name) === -1 ? "" : "!") + "test: parse " + file.path
      module.exports[testName] = function (done) {
        const rows = file.data.split(/\n/)
              .concat(["PREFIX qwer: <>"]) // Make sure we end up in the shexDoc production.
        const session = new EditSession(rows, new ShExCMode());
        const badTypes = ["text", "invalid"];
        rows.forEach((row, i) => session.getTokens(i).reduce((column, token) => {
          assert.ok(badTypes.indexOf(token.type) === -1, makeError())
          return column + token.value.length;

          // Leave enough stack so folks find their way here.
          function makeError () {
            const ret = Error(file.path + ":" + i + ":" + column + " invalid token: " + JSON.stringify(token) + " in: \"" + row + "\"");
            const stack = ret.stack.split(/\n/)
            ret.stack = stack.slice(0, 2).join("\n");
            return ret;
          }
        }, 0))
        done()
      }
      next();
    })
    .end(doneBuildingTests)
} else doneBuildingTests()

function doneBuildingTests () {
  if (typeof module !== "undefined" && module === require.main) {
    Async.test.testcase(module.exports).exec();
  }
}
