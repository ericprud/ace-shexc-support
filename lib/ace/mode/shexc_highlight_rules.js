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

/* Some handy CSS for this mode:
   .ace_shapeExprLabel { background-color: #fff0c0; }
   .ace_shapeExprRef { line-height: 1.7ex; vertical-align: top; border-bottom: .3ex solid #dfd0a0; }
   .ace_tripleExprLabel { background-color: #f0c0ff; }
   .ace_tripleExprRef { line-height: 1.7ex; vertical-align: top; border-bottom: .3ex solid #d0a0df; }
   .ace_annotation { line-height: 1.7ex; vertical-align: top; border-bottom: .3ex solid #c7d7e0; }

   Desperate way to bump up the font-size in the kitchen-sink demo:
   setTimeout(() => window.ace.setFontSize("18px"), 200)
 */

define(function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var DocCommentHighlightRules = require("./doc_comment_highlight_rules").DocCommentHighlightRules;
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

  /** terminals from <http://shex.io/shex-semantics/index.html#term-IRIREF>
   * <IRIREF>      ::=          "<" ([^#0000- <>\"{}|^`\\] | UCHAR)* ">"
   * <PNAME_NS>	   ::=   	PN_PREFIX? ":"
   * <PNAME_LN>	   ::=   	PNAME_NS PN_LOCAL
   * ... (see link for the rest)
   */
  var HEX_RE = '[0-9a-fA-F]'
  var UCHAR_RE = '\\\\(?:u' + HEX_RE + '{4}|U' + HEX_RE + '{8})'
  var UCHAR_BAD_RE = '\\\\(?:u' + HEX_RE + '{0,4}|U' + HEX_RE + '{0,8})'
  var ECHAR_RE = '\\\\[tbnrf\\\\"\']'
  var ECHAR_BAD_RE = '\\\\[^tbnrf\\\\"\']'
  var STRING_ESCAPE_RE = '(' + ECHAR_RE + '|' + UCHAR_RE + ')'
  var STRING_ESCAPE_BAD_RE = '(' + ECHAR_BAD_RE + '|' + UCHAR_BAD_RE + ')'
  var IRIREF_RE = '<([^<>"{}|^`\\\\]|' + UCHAR_RE + ')*>'
  var PN_CHARS_BASE_RE = '[a-zA-Z]'
  var PN_CHARS_U_RE = [PN_CHARS_BASE_RE, '_'].join('|')
  var PN_CHARS_RE = '(' + [PN_CHARS_U_RE, '-', '[0-9]'].join('|') + ')'
  var PN_PREFIX_RE = PN_CHARS_BASE_RE + '((' + PN_CHARS_RE + '|\\.)*' + PN_CHARS_RE + ')?'
  var PNAME_NS_RE = '(' + PN_PREFIX_RE + ')?:'
  var LANGTAG_RE = "@[a-zA-Z]+(-[a-zA-Z0-9]+)*"
  var PN_LOCAL_ESC_RE = '\\\\[_~.!$&\'()*+,;=/?#@%-]'
  var PERCENT_RE = '%' + HEX_RE + HEX_RE
  var PERCENT_BAD_RE = '%' + HEX_RE + '{0,2}'
  var PLX_RE = [PERCENT_RE, PN_LOCAL_ESC_RE].join('|')
  var PN_LOCAL_RE = '(' + [PN_CHARS_U_RE, ':', '[0-9]', PLX_RE].join('|') + ')'
    + '(' + '(' + [PN_CHARS_RE, '\\.', ':', PLX_RE].join('|') + ')' + ')*'
  var PNAME_LN_RE = PNAME_NS_RE + PN_LOCAL_RE
  /** IRI forms from <https://shexspec.github.io/spec/#prod-iri>
   * iri	   ::=   	IRIREF | prefixedName
   * prefixedName  ::=   	PNAME_LN | PNAME_NS
   * ... (see link for the rest)
   */
  var prefixedName_RE = PNAME_LN_RE + '|' + PNAME_NS_RE
  var iris_RE = '(' + [prefixedName_RE, IRIREF_RE].join('|') + ')'
  var PERCENT = { className: 'meta-keyword', begin: PERCENT_RE }
  var UCHAR = { className: 'meta-keyword', begin: UCHAR_RE }
  var PN_LOCAL_ESC = { className: 'meta-keyword', begin: PN_LOCAL_ESC_RE }


var ShExCHighlightRules = function(options) {
    // see: http://shex.io/
    var shapeExprMapper = this.createKeywordMapper({
      "keyword": "and|or|not|extra|closed|extends|"
    }, "identifier", true);
    var keywordMapper = this.createKeywordMapper({
      "variable.language": "and|or|not|extra|closed|extends|" ,
      "keyword": "mininclusive|maxinclusive|minexclusive|maxexclusive|minlength|maxlength",
      "support.function":
      "alert",
      "constant.language.boolean": "true|false"
    }, "identifier", true);

  const pushTo = 'shapeExpr'
  const popTo = 'tripleExpr'
  const allInvalid = [ { regex: /\s+/, token: "whiteSpace" }, { regex: /./, token: "invalid" } ]

  function nottableAtom (prefix = "") {
    const ret = {  }
    ret[prefix + "shapeNot"] = [
      { regex: /\s/, token: "whiteSpace" },
      { regex: anyCase("NOT"), token: "keyword", next: prefix + "shapeAtom" },
      { regex: /(?:)/, next: prefix + "shapeAtom" }
    ]
    ret[prefix + "shapeAtom"] = [
      { regex: /\./, token: "keyword.atom", next: prefix + "andOrOpt" },
      iri(".atom.datatype", {next: prefix + "andOrOpt" }),
      { regex: /@/, token: "operator", push: prefix + "shapeRef", next: prefix + "andOrOpt" },
      { regex: /\(/, token: "lparen", push: "nested_shapeNot", next: prefix + "andOrOpt" },
      { regex: "(?=" + anyCase("EXTRA", "CLOSED") + ")", push: "shape", next: prefix + "andOrOpt" },
      { regex: /(?=\{|)/, push: "shape", next: prefix + "andOrOpt" },
      allInvalid
    ]
    ret[prefix + "shapeRef"] = [
      iri(".atom.shapeExprRef", {next: "pop" }),
      allInvalid
    ]
    return ret
  }

  this.$rules = Object.assign(
    { start: [ { regex: /(?:)/, token: "keyword", next: "shexDoc" } ],
      shexDoc: [
        { regex: anyCase("PREFIX"), token: "keyword", push: "PNAME_NS" },
        { regex: anyCase("BASE", "IMPORT"), token: "keyword", push: "IRIREF" },
        iri(".function.shapeExprLabel", {next: "shexDoc", push: "shapeNot" }),
        allInvalid
      ],
      PNAME_NS: [
        { regex: PNAME_NS_RE, token: "constant.library", push: "IRIREF", next: "pop" },
        allInvalid
      ],
      IRIREF: IRIREF(""), // for PREFIX decls
    },

    // shapeOr, shapeAnd, shapeNot, shapeAtom outside ()s
    nottableAtom(""),
    { andOrOpt: [
      { regex: anyCase("AND", "OR"), token: "operator", next: "shapeNot" },
      { regex: /\s+/, token: "whiteSpace" },
      { regex: /(?:)/, next: "pop" }
    ] },

    // shapeOr, shapeAnd, shapeNot, shapeAtom inside ()s
    nottableAtom("nested_"),
    { nested_andOrOpt: [
      { regex: anyCase("AND", "OR"), token: "operator", next: "nested_shapeNot" },
      { regex: /\)/, token: "rparen", next: "pop" },
      allInvalid
    ] },

    { shape: [
      { regex: anyCase("CLOSED"), token: "keyword"},
      { regex: /\{/, token: "lcurly", next: [
        { regex: /\}/, token: "rcurly", next: "pop" },
        allInvalid
      ] },
      allInvalid
    ] },
  )

  // All top-level productions get prefixed with comment rules.
  // Debugging note: this adds 1 to the indexes of the above rules before
  // normalizeRules() and 3 after.
  Object.values(this.$rules).forEach(addComments)

  function addComments (rules) {
    rules.unshift([
      {
        token : "comment.doc",
        regex : "\\/\\*(?=\\*)",
        push: [
          {
            regex : "(?<![a-zA-Z0-9_+])@[\\w\\d_]+", // TODO: all email chars before '@'
            token : "comment.doc.tag",
          },
          DocCommentHighlightRules.getTagRule(),
          {
            regex : "\\*\\/",
            token : "comment.doc",
            next  : "pop"
          },
          {
            defaultToken : "comment.doc",
            caseInsensitive: true
          }
        ]
      }, {
        token : "comment", // multi line comment
        regex : /\/\*/,
        push: [
          DocCommentHighlightRules.getTagRule(),
          {token : "comment", regex : "\\*\\/", next : "pop"},
          {defaultToken : "comment", caseInsensitive: true}
        ]
      }, {
        token : "comment",
        regex : "#",
        push: [
          DocCommentHighlightRules.getTagRule(),
          {token : "comment", regex : "$|^", next : "pop"},
          {defaultToken : "comment", caseInsensitive: true}
        ]
      }
    ])
  }

  /**
      iri({next: "shexDoc", push: "shapeAtom"}),
   */
  function iri (token, next) {
    return [
      { regex: '<', token: "constant.language" + token, next: [ // TODO: use IRIREF(token)
        { regex : UCHAR_RE, token: "constant.language" + token + ".escape" },
        { regex : UCHAR_BAD_RE, token: "constant.language" + token + ".invalid", },
        Object.assign({ regex : ">", token: "constant.language" + token }, next),
        { defaultToken: "constant.language" + token }
      ] },
      { regex: PNAME_NS_RE, token: "constant.library" + token, next: [
        { regex : PN_LOCAL_ESC_RE, token: "variable" + token + '.escape' },
        { regex : PERCENT_RE, token: "variable" + token + '.escape' },
        Object.assign({ regex : "(?!" + PN_LOCAL_RE + ")", token: "variable" + token }, next), // is this sound and complete?
        { defaultToken: "variable" + token }
      ] },
    ]
  }

  function IRIREF (token) {
    return [
      { regex: '<', token: "constant.language" + token, next: [
        { regex : UCHAR_RE, token: "constant.language" + token + ".escape" },
        { regex : UCHAR_BAD_RE, token: "constant.language" + token + ".invalid", },
        { regex : ">", token: "constant.language" + token, next : "pop" },
        { defaultToken: "constant.language" + token }
      ] },
      allInvalid
    ]
  }

  function anyCase () {
    const args = Array.from(arguments)
    return "\\b(?:"+args.map(
      arg => [].map.call(
        arg, ch => "[" + ch.toUpperCase() + ch.toLowerCase() + "]"
      ).join("")
    ).join("|")+")\\b"
  }

  const x = {
    start: [
      // shapeExprLabel IRI
      {
        token: "shapeExprLabel.function.constant.language",
        regex: '<',
        next: "IRIREF999_shapeExprLabel"
      }, {
        token: "shapeExprLabel.function.constant.library",
        regex: PNAME_NS_RE,
        next: "PN_LOCAL999_shapeExprLabel"
      },
    ],
    PNAME_NS_IRIREF999_LT_start: [
      comments999("PNAME_NS_IRIREF999_LT_start"),
      {
        token: "prefix.constant.library",
        regex: PNAME_NS_RE,
        next: "IRIREF999_LT_start"
      }
    ],
    IRIREF999_LT_start: IRIREF999_LT("IRIREF999_LT_start", "constant.language", "IRIREF999_start"),
    IRIREF999_start : IRIREF999("constant.language", "start"),

    IRIREF999_shapeExprLabel : IRIREF999("shapeExprLabel.function.constant.language", "shapeExpr", pushTo),
    PN_LOCAL999_shapeExprLabel: PN_LOCAL999(tag3("shapeExprLabel.function.variable", "shapeExprLabel", "shapeExpr"), "start", pushTo),

    shapeExpr: [
        DocCommentHighlightRules.getStartRule("doc_shapeExpr-start"),
        comments999("shapeExpr"),
        {
          token: tag("string.regexp", "shapeExpr"),
          regex: "\\/(?!/)",
          next: "regex"
        },
        {
          token : tag("operator", "shapeExpr"),
          regex : /[.;|](\s*;)*/,
          next  : "pop"
        },
        {
          token : tag("paren.lparen.shape", "shapeExpr"),
          regex : /\{/,
          next  : "tripleExpr"
        },
        {
          token : tag("paren.rparen.shape", "shapeExpr"),
          regex : /(?=\})/,
          next  : "pop"
        },
        {
          token : tag("list.paren.lparen", "shapeExpr"),
          regex : /\[/,
          next  : "valueSet"
        },
        {
          token : tag("paren.lparen", "shapeExpr"),
          regex : /\(/,
          push  : "shapeExpr",
          next  : "shapeExpr"
        },
        {
          token : tag("paren.rparen", "shapeExpr"),
          regex : /\)/,
          next  : "pop"
        },
        {
          token : tag("paren.rparen", "shapeExpr"),
          regex : /\)/,
          next  : "shapeExpr"
        },

        // datatype IRI
        {
          // onMatch: function () { debugger; return this.token },
          token: tag("datatype.constant.language", "shapeExpr"),
          regex: '<',
          next: "IRIREF999_datatype"
        }, {
          token: tag("datatype.constant.library", "shapeExpr"),
          regex: PNAME_NS_RE,
          next: "PN_LOCAL999_datatype"
        },

        {
          token: tag("shapeExprRef.value", "shapeExpr"),
          regex: '@',
          next: "IRI999_shapeExprRef"
        },

        {
          token : tag("keyword", "shapeExpr"),
          regex : /\b([Aa][Nn][Dd]|[Oo][Rr]|[Nn][Oo][Tt]|[Cc][Ll][Oo][Ss][Ee][Dd])\b/,
          next  : "shapeExpr"
        },

        {
          token : tag("keyword", "shapeExpr"),
          regex : /\b[Cc][Ll][Oo][Ss][Ee][Dd]\b/,
          next  : "shape"
        },

        {
          token : tag("keyword", "shapeExpr"),
          regex : /\b[Ee][Xx][Tt][Rr][Aa]\b/,
          next  : "extra"
        },

        // <annotation>
        {
          token: tag("shapeExpr.annotation.meta", "shapeExpr"),
          regex: '\/\/',
          next: "IRI999_shapeExpr_annotation_predicate"
        },
        // </annotation>

        {
          token : "whitespace",
          regex : /\s/,
        },
        {
          token : "invalid",
          regex : /./,
        },
      ],
      // IRIREF999_shapeExpr_datatype : IRIREF999((a,b,c) => { debugger; return tag("constant.language", "datatype") }, "shapeExpr"),
      IRIREF999_datatype : IRIREF999(tag("datatype.constant.language", "IRIREF999_datatype"), "shapeExpr"),
      PN_LOCAL999_datatype: PN_LOCAL999(tag("variable", "datatype"), "shapeExpr"),
      IRI999_shapeExprRef: IRI999("shapeExprRef.value", "shapeExprRef_IRI999"),
      IRIREF999_shapeExprRef_IRI999 : IRIREF999(tag("shapeExprRef.constant.language", "IRIREF999_shapeExprRef_IRI999"), "shapeExpr"),
      PN_LOCAL999_shapeExprRef_IRI999: PN_LOCAL999(tag("shapeExprRef.value.variable", "PN_LOCAL999_shapeExprRef_IRI999"), "shapeExpr"),

      // <annotation>
      IRI999_shapeExpr_annotation_predicate: IRI999("shapeExpr.annotation.predicate.value", "shapeExpr_annotation_predicate_IRI999"),
      IRIREF999_shapeExpr_annotation_predicate_IRI999 : IRIREF999(tag("shapeExpr.annotation.predicate.constant.language", "IRIREF999_shapeExpr_annotation_predicate_IRI999"), "term_shapeExpr_annotation_object"),
      PN_LOCAL999_shapeExpr_annotation_predicate_IRI999: PN_LOCAL999(tag("shapeExpr.annotation.predicate.value.variable", "PN_LOCAL999_shapeExpr_annotation_predicate_IRI999"), "term_shapeExpr_annotation_object"),
      term_shapeExpr_annotation_object: term999("shapeExpr.annotation.object.value", "shapeExpr_annotation_object"),
      IRIREF999_shapeExpr_annotation_object_IRI999 : IRIREF999(tag("shapeExpr.annotation.object.constant.language", "IRIREF999_shapeExpr_annotation_object_IRI999"), "shapeExpr"),
      PN_LOCAL999_shapeExpr_annotation_object_IRI999: PN_LOCAL999(tag("shapeExpr.annotation.object.value.variable", "PN_LOCAL999_shapeExpr_annotation_object_IRI999"), "shapeExpr"),
      qqstring_shapeExpr_annotation_object: STRING_LITERAL999('"', tag("shapeExpr.annotation.value.string", "qqstring_shapeExpr_annotation_object"), "IRI999_valueSet_datatype", "langtag_valueSet_value", "shapeExpr"),
      qstring_shapeExpr_annotation_object : STRING_LITERAL999("'", tag("shapeExpr.annotation.value.string",  "qstring_shapeExpr_annotation_object"), "IRI999_valueSet_datatype", "langtag_valueSet_value", "shapeExpr"),
      // </annotation>

      shape: [
        comments999("shape"),
        {
          token : tag("paren.lparen.shape", "shape"),
          regex : /\{/,
          next  : "tripleExpr"
        },

        {
          token : tag("keyword", "shape"),
          regex : /\b[Cc][Ll][Oo][Ss][Ee][Dd]\b/,
          next  : "shape"
        },

        {
          token : tag("keyword", "shape"),
          regex : /\b[Ee][Xx][Tt][Rr][Aa]\b/,
          next  : "extra"
        },
      ],

      extra: [
        comments999("extra"),
        {
          token : tag("paren.lparen.extra", "extra"),
          regex : /\{/,
          next  : "tripleExpr"
        },

        {
          token : tag("keyword", "shapeExpr"),
          regex : /\b[Cc][Ll][Oo][Ss][Ee][Dd]\b/,
          next  : "shape"
        },

        {
          token : tag("keyword", "shapeExpr"),
          regex : /\b[Ee][Xx][Tt][Rr][Aa]\b/,
          next  : "extra"
        },

        // extra IRI
        {
          // onMatch: function () { debugger; return this.token },
          token: tag("extra.constant.language", "extra"),
          regex: '<',
          next: "IRIREF999_extra"
        }, {
          token: tag("extra.constant.library", "extra"),
          regex: PNAME_NS_RE,
          next: "PN_LOCAL999_extra"
        },
      ],
      // IRIREF999_extra_extra : IRIREF999((a,b,c) => { debugger; return tag("constant.language", "extra") }, "extra"),
      IRIREF999_extra : IRIREF999(tag("constant.language", "extra"), "extra"),
      PN_LOCAL999_extra: PN_LOCAL999(tag("variable", "extra"), "extra"),

      regex: [
        {
          // escapes
          token: "regexp.keyword.operator",
          regex: "\\\\(?:u[\\da-fA-F]{4}|x[\\da-fA-F]{2}|.)"
        }, {
          // flag
          token: "string.regexp",
          regex: "/[sxngimy]*",
          next: "shapeExpr"
        }, {
          // invalid operators
          token : "invalid",
          regex: /\{\d+\b,?\d*\}[+*]|[+*$^?][+*]|[$^][?]|\?{3,}/
        }, {
          // operators
          token : "constant.language.escape",
          regex: /\(\?[:=!]|\)|\{\d+\b,?\d*\}|[+*]\?|[()$^+*?.]/
        }, {
          token : "constant.language.delimiter",
          regex: /\|/
        }, {
          token: "constant.language.escape",
          regex: /\[\^?/,
          next: "regex_character_class"
        }, {
          token: "empty",
          regex: "$",
          next: "shapeExpr"
        }, {
          defaultToken: "string.regexp"
        }
      ],
      regex_character_class: [
        {
          token: "regexp.charclass.keyword.operator",
          regex: "\\\\(?:u[\\da-fA-F]{4}|x[\\da-fA-F]{2}|.)"
        }, {
          token: "constant.language.escape",
          regex: "]",
          next: "regex"
        }, {
          token: "constant.language.escape",
          regex: "-"
        }, {
          token: "empty",
          regex: "$",
          next: "shapeExpr"
        }, {
          defaultToken: "string.regexp.charachterclass"
        }
      ],

      tripleExpr: [
        {
          // onMatch: function () { debugger; return this.token },
          token : tag("paren.rparen.shape", "tripleExpr"),
          regex : /\}/,
          next  : "pop"
        },
        comments999("tripleExpr"),

        {
          token: tag("tripleExprLabel.value", "tripleExpr"),
          regex: '\\$',
          next: "IRI999_tripleExprLabel"
        },

        {
          token: tag("tripleExprRef.value", "tripleExpr"),
          regex: '\\&',
          next: "IRI999_tripleExprRef"
        },

        // predicate IRI
        {
          token: tag("constant.language", "tripleConstraint"),
          regex: '<',
          next: "IRIREF999_tripleExpr_tripleExpr_predicate"
        }, {
          token: tag("constant.library", "tripleConstraint"),
          regex: PNAME_NS_RE,
          next: "PN_LOCAL999_tripleExpr_predicate"
        },

        // annotation
        {
          token: tag("tripleExpr.annotation.meta", "tripleExpr"),
          regex: '\/\/',
          next: "IRI999_tripleExpr_annotation_predicate"
        },
        {
          token : "whitespace",
          regex : /\s/,
        },
        {
          token : "invalid",
          regex : /./,
        },
      ],
      // IRIREF999_tripleExpr_tripleExpr_predicate : IRIREF999((a,b,c) => { debugger; return tag("constant.language", "tripleConstraint") }, "tripleExpr", pushTo),
      IRIREF999_tripleExpr_tripleExpr_predicate : IRIREF999(tag("constant.language", "tripleConstraint"), "tripleExpr", pushTo),
      PN_LOCAL999_tripleExpr_predicate: PN_LOCAL999(tag("variable", "tripleConstraint"), "tripleExpr", pushTo),
      IRI999_tripleExprLabel: IRI999("tripleExprLabel.value", "tripleExprLabel_IRI999"),
      IRIREF999_tripleExprLabel_IRI999 : IRIREF999(tag("tripleExprLabel.constant.language", "IRIREF999_tripleExprLabel_IRI999"), "tripleExpr"),
      PN_LOCAL999_tripleExprLabel_IRI999: PN_LOCAL999(tag("tripleExprLabel.value.variable", "PN_LOCAL999_tripleExprLabel_IRI999"), "tripleExpr"),
      IRI999_tripleExprRef: IRI999("tripleExprRef.value", "tripleExprRef_IRI999"),
      IRIREF999_tripleExprRef_IRI999 : IRIREF999(tag("tripleExprRef.constant.language", "IRIREF999_tripleExprRef_IRI999"), "tripleExprEnd"),
      PN_LOCAL999_tripleExprRef_IRI999: PN_LOCAL999(tag("tripleExprRef.value.variable", "PN_LOCAL999_tripleExprRef_IRI999"), "tripleExprEnd"),
      tripleExprEnd: [
        comments999("tripleExprEnd"),
        {
          token : "operator",
          regex : /[.;|](\s*;)*/,
          next  : "tripleExpr"
        },
        {
          token : tag("paren.rparen.shape", "tripleExprEnd"),
          regex : /(?=\})/,
          next  : "pop"
        },
      ],
      IRI999_tripleExpr_annotation_predicate: IRI999("tripleExpr_annotation_predicate.value", "tripleExpr_annotation_predicate_IRI999"),
      IRIREF999_tripleExpr_annotation_predicate_IRI999 : IRIREF999(tag("tripleExpr_annotation_predicate.constant.language", "IRIREF999_tripleExpr_annotation_predicate_IRI999"), "term_tripleExpr_annotation_object"),
      PN_LOCAL999_tripleExpr_annotation_predicate_IRI999: PN_LOCAL999(tag("tripleExpr_annotation_predicate.value.variable", "PN_LOCAL999_tripleExpr_annotation_predicate_IRI999"), "term_tripleExpr_annotation_object"),
      term_tripleExpr_annotation_object: term999("tripleExpr_annotation_object.value", "tripleExpr_annotation_object"),
      IRIREF999_tripleExpr_annotation_object_IRI999 : IRIREF999(tag("tripleExpr_annotation_object.constant.language", "IRIREF999_tripleExpr_annotation_object_IRI999"), "tripleExpr"),
      PN_LOCAL999_tripleExpr_annotation_object_IRI999: PN_LOCAL999(tag("tripleExpr_annotation_object.value.variable", "PN_LOCAL999_tripleExpr_annotation_object_IRI999"), "tripleExpr"),
      qqstring_tripleExpr_annotation_object: STRING_LITERAL999('"', tag("value.string", "qqstring_valueSet"), "IRI999_valueSet_datatype", "langtag_valueSet_value", "valueSet"),
      qstring_tripleExpr_annotation_object : STRING_LITERAL999("'", tag("value.string", "qqstring_valueSet"), "IRI999_valueSet_datatype", "langtag_valueSet_value", "valueSet"),

      valueSet: [
        DocCommentHighlightRules.getStartRule("doc_valueSet-start"),
        comments999("valueSet"),
        {
          token : tag("value.string", "valueSet"),
          regex : "'(?=.)",
          next  : "qstring_valueSet"
        }, {
          token : tag("value.string", "valueSet"),
          regex : '"(?=.)',
          next  : "qqstring_valueSet"
        }, {
          // onMatch: function (a, b, c) { debugger; return this.token },
          token : tag("list.paren.rparen", "valueSet"),
          regex : /\]/,
          next  : "shapeExpr"
        },

        // value IRI
        {
          // onMatch: function () { debugger; return this.token },
          token: tag("value.constant.language", "valueSet"),
          regex: '<',
          next: "IRIREF999_valueSet_IRI999"
        }, {
          token: tag("value.constant.library", "valueSet"),
          regex: PNAME_NS_RE,
          next: "PN_LOCAL999_valueSet_IRI999"
        },
      ],
      // IRIREF999_valueSet_IRI999 : IRIREF999((a,b,c) => { console.log("HGERE"); debugger; return tag("value.constant.language", "valueSet") }, "shapeExpr"),
      IRIREF999_valueSet_IRI999 : IRIREF999(tag("value.constant.language", "valueSet"), "valueSet"),
      PN_LOCAL999_valueSet_IRI999: PN_LOCAL999(tag("value.variable", "valueSet"), "valueSet"),
      qqstring_valueSet: STRING_LITERAL999('"', tag("value.string", "qqstring_valueSet"), "IRI999_valueSet_datatype", "langtag_valueSet_value", "valueSet"),
      qstring_valueSet: STRING_LITERAL999("'", tag("value.string", "qqstring_valueSet"), "IRI999_valueSet_datatype", "langtag_valueSet_value", "valueSet"),
      IRI999_valueSet_datatype: IRI999(tag("value", "IRI999_valueSet_datatype"), "IRI999_valueSet_datatype"),
      langtag_valueSet_value: langtag999(tag("value.string", "langtag_valueSet_value"), "valueSet"),
      IRIREF999_IRI999_valueSet_datatype : IRIREF999(tag("constant.language", "value_datatype"), "valueSet"),
      PN_LOCAL999_IRI999_valueSet_datatype: PN_LOCAL999(tag("value.variable", "value_datatype"), "valueSet"),
  };

debugger
  /*
    this.embedRules(DocCommentHighlightRules, "doc_start-",
        [ DocCommentHighlightRules.getEndRule("start") ]);

  this.embedRules(DocCommentHighlightRules, 'doc_shapeExpr-',
                  [ DocCommentHighlightRules.getEndRule('shapeExpr') ]);
  this.embedRules(DocCommentHighlightRules, 'doc_valueSet-',
                  [ DocCommentHighlightRules.getEndRule('valueSet') ]);
  */
  this.normalizeRules();
};

    function tag (token, role = '') {
      return tag3(token, role, "")
    }
  function tag3 (token, role = '', self) {
    return token + '.' + self + role
  }

  function fixup (rules, prefix, from, to) {
    const refs = refsTo(rules, prefix, from)
    Object.keys(refs).forEach(
      k => refs[k].forEach(
        i => rules[k][i].next = to
      )
    )
  }

  function refsTo (rules, prefix, next) {
    return Object.keys(rules).filter(k => k.startsWith(prefix))
      .reduce(
        (acc, k) => {
          let hits = rules[k].reduce(
            (acc, r, i) => 
              r.next === prefix + next ? acc.concat(i) : acc
            , []
          )
          if (hits.length)
            acc[k] = hits 
          return acc}
        , {}
      )
  }

  function nestedShape (outer, self, inner) {
    return {
    }
    function tag (token, role = '') {
      return tag3(token, role, self)
    }
  }

  function IRIREF999_LT (self, token, next) { return [
    comments999(self),
    addToken999({
      regex : '<(?=.)',
      next: next
    }, token)
  ]}

  function IRI999 (token, next) {
    return [
      {
        token: token + ".whiteSpace",
        regex: '\\s+',
      }, {
        token: token + ".constant.language",
        regex: '<',
        next: "IRIREF999_" + next
      }, {
        token: token + ".constant.library",
        regex: PNAME_NS_RE,
        next: "PN_LOCAL999_"  + next
      },
    ]
  }

  function STRING_LITERAL999 (quote, token, datatype, langtag, next) {
    return [
      {
        token : token + ".escape",
        regex : STRING_ESCAPE_RE
      }, {
        token : "invalid",
        regex : STRING_ESCAPE_BAD_RE
      }, {
        token : "value.string",
        regex : "\\\\$",
        consumeLineEnd  : true
      }, {
        token : token,
        regex : quote + '\\^\\^',
        next  : datatype
      }, {
        token : token,
        regex : quote + '@',
        next  : langtag
      }, {
        token : token,
        regex : quote,
        next  : next
      }, {
        defaultToken: token,
      }
    ]
  }

  function term999 (token, next) {
    return IRI999(token, next).concat(
      {
        token : token,
        regex : "'(?=.)",
        next  : "qstring_" + next
      }, {
        token : token,
        regex : '"(?=.)',
        next  : "qqstring_" + next
      }
    )
  }

  function langtag999 (token, next) {
    return [
      {
        token: token + ".meta",
        regex: LANGTAG_RE.substr(1), // already consumed the '@'
        next: next
      },
    ]
  }

  function IRIREF999 (token, next, push) {
    return [
        {
          token : token + ".escape",
          regex : UCHAR_RE
        }, {
          token : token + ".invalid",
          regex : UCHAR_BAD_RE
        }, addToken999({
          regex : ">",
          next : next,
          push : push
        }, token), {
          defaultToken: token
        }
    ]
  }

  function PN_LOCAL999 (token, next, push) {
    return [
      {
        token : token + '.escape',
        regex : PN_LOCAL_ESC_RE
      }, {
        token : token + '.escape',
        regex : PERCENT_RE
      }, {
        // onMatch: function () { debugger; return this.token },
        token : token,
        regex : "(?!" + PN_LOCAL_RE + ")", // is this sound and complete?
        next  : next,
        push  : push
      }, {
        defaultToken: token
      },      
    ]
  }

  function addToken999 (state, token) {
    return Object.assign(
      {},
      state,
      typeof token === 'function' ? {onMatch  : token} : {token  : token}
    )
  }

  oop.inherits(ShExCHighlightRules, TextHighlightRules);

  function comments999(next) {
    return [
      {
        token : "comment", // multi line comment
        regex : /\/\*/,
        next: [
          DocCommentHighlightRules.getTagRule(),
          {token : "comment", regex : "\\*\\/", next : next || "pop"},
          {defaultToken : "comment", caseInsensitive: true}
        ]
      }, {
        token : "comment",
        regex : "#",
        next: [
          DocCommentHighlightRules.getTagRule(),
          {token : "comment", regex : "$|^", next : next || "pop"},
          {defaultToken : "comment", caseInsensitive: true}
        ]
      }
    ];
  }

exports.ShExCHighlightRules = ShExCHighlightRules;
});
