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

  this.$rules = {
    // Regular expressions are only allowed after certain tokens. This
    // makes sure we don't mix up regexps with the divison operator
    start: [
      DocCommentHighlightRules.getStartRule("doc_start-start"),
      comments("start"),
      {
        token: "keyword",
        regex: "[Pp][Rr][Ee][Ff][Ii][Xx]",
        next: "PNAME_NS_IRIREF_LT_start"
      }, {
        token: "keyword",
        regex: "[Bb][Aa][Ss][Ee]",
        next: "IRIREF_LT_start"
      }, {
        token: "keyword",
        regex: "[Ii][Mm][Pp][Oo][Rr][Tt]",
        next: "IRIREF_LT_start"
      },

      // shapeExprLabel IRI
      {
        token: "shapeExprLabel.function.constant.language",
        regex: '<',
        next: "IRIREF_shapeExprLabel"
      }, {
        token: "shapeExprLabel.function.constant.library",
        regex: PNAME_NS_RE,
        next: "PN_LOCAL_shapeExprLabel"
      },

      // indicate some invalid constructs
      {
        token : "invalid",
        regex : /[\[({\])}]/,
      },
    ],
    PNAME_NS_IRIREF_LT_start: [
      comments("PNAME_NS_IRIREF_LT_start"),
      {
        token: "prefix.constant.library",
        regex: PNAME_NS_RE,
        next: "IRIREF_LT_start"
      }
    ],
    IRIREF_LT_start: IRIREF_LT("IRIREF_LT_start", "constant.language", "IRIREF_start"),
    IRIREF_start : IRIREF("constant.language", "start"),

    IRIREF_shapeExprLabel : IRIREF("shapeExprLabel.function.constant.language", "start", pushTo),
    PN_LOCAL_shapeExprLabel: PN_LOCAL(tag3("shapeExprLabel.function.variable", "shapeExprLabel", "start"), "start", pushTo),

      shapeExpr: [
        DocCommentHighlightRules.getStartRule("doc_shapeExpr-start"),
        comments("shapeExpr"),
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
          next: "IRIREF_datatype"
        }, {
          token: tag("datatype.constant.library", "shapeExpr"),
          regex: PNAME_NS_RE,
          next: "PN_LOCAL_datatype"
        },

        {
          token: tag("shapeExprRef.value", "shapeExpr"),
          regex: '@',
          next: "IRI_shapeExprRef"
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
          next: "IRI_shapeExpr_annotation_predicate"
        },
        // </annotation>
      ],
      // IRIREF_shapeExpr_datatype : IRIREF((a,b,c) => { debugger; return tag("constant.language", "datatype") }, "shapeExpr"),
      IRIREF_datatype : IRIREF(tag("datatype.constant.language", "IRIREF_datatype"), "shapeExpr"),
      PN_LOCAL_datatype: PN_LOCAL(tag("variable", "datatype"), "shapeExpr"),
      IRI_shapeExprRef: IRI("shapeExprRef.value", "shapeExprRef_IRI"),
      IRIREF_shapeExprRef_IRI : IRIREF(tag("shapeExprRef.constant.language", "IRIREF_shapeExprRef_IRI"), "shapeExpr"),
      PN_LOCAL_shapeExprRef_IRI: PN_LOCAL(tag("shapeExprRef.value.variable", "PN_LOCAL_shapeExprRef_IRI"), "shapeExpr"),

      // <annotation>
      IRI_shapeExpr_annotation_predicate: IRI("shapeExpr.annotation.predicate.value", "shapeExpr_annotation_predicate_IRI"),
      IRIREF_shapeExpr_annotation_predicate_IRI : IRIREF(tag("shapeExpr.annotation.predicate.constant.language", "IRIREF_shapeExpr_annotation_predicate_IRI"), "term_shapeExpr_annotation_object"),
      PN_LOCAL_shapeExpr_annotation_predicate_IRI: PN_LOCAL(tag("shapeExpr.annotation.predicate.value.variable", "PN_LOCAL_shapeExpr_annotation_predicate_IRI"), "term_shapeExpr_annotation_object"),
      term_shapeExpr_annotation_object: term("shapeExpr.annotation.object.value", "shapeExpr_annotation_object"),
      IRIREF_shapeExpr_annotation_object_IRI : IRIREF(tag("shapeExpr.annotation.object.constant.language", "IRIREF_shapeExpr_annotation_object_IRI"), "shapeExpr"),
      PN_LOCAL_shapeExpr_annotation_object_IRI: PN_LOCAL(tag("shapeExpr.annotation.object.value.variable", "PN_LOCAL_shapeExpr_annotation_object_IRI"), "shapeExpr"),
      qqstring_shapeExpr_annotation_object: STRING_LITERAL('"', tag("shapeExpr.annotation.value.string", "qqstring_shapeExpr_annotation_object"), "IRI_valueSet_datatype", "langtag_valueSet_value", "shapeExpr"),
      qstring_shapeExpr_annotation_object : STRING_LITERAL("'", tag("shapeExpr.annotation.value.string",  "qstring_shapeExpr_annotation_object"), "IRI_valueSet_datatype", "langtag_valueSet_value", "shapeExpr"),
      // </annotation>

      shape: [
        comments("shape"),
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
        comments("extra"),
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
          next: "IRIREF_extra"
        }, {
          token: tag("extra.constant.library", "extra"),
          regex: PNAME_NS_RE,
          next: "PN_LOCAL_extra"
        },
      ],
      // IRIREF_extra_extra : IRIREF((a,b,c) => { debugger; return tag("constant.language", "extra") }, "extra"),
      IRIREF_extra : IRIREF(tag("constant.language", "extra"), "extra"),
      PN_LOCAL_extra: PN_LOCAL(tag("variable", "extra"), "extra"),

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
        comments("tripleExpr"),

        {
          token: tag("tripleExprLabel.value", "tripleExpr"),
          regex: '\\$',
          next: "IRI_tripleExprLabel"
        },

        {
          token: tag("tripleExprRef.value", "tripleExpr"),
          regex: '\\&',
          next: "IRI_tripleExprRef"
        },

        // predicate IRI
        {
          token: tag("constant.language", "tripleConstraint"),
          regex: '<',
          next: "IRIREF_tripleExpr_tripleExpr_predicate"
        }, {
          token: tag("constant.library", "tripleConstraint"),
          regex: PNAME_NS_RE,
          next: "PN_LOCAL_tripleExpr_predicate"
        },

        // annotation
        {
          token: tag("tripleExpr.annotation.meta", "tripleExpr"),
          regex: '\/\/',
          next: "IRI_tripleExpr_annotation_predicate"
        },
      ],
      // IRIREF_tripleExpr_tripleExpr_predicate : IRIREF((a,b,c) => { debugger; return tag("constant.language", "tripleConstraint") }, "tripleExpr", pushTo),
      IRIREF_tripleExpr_tripleExpr_predicate : IRIREF(tag("constant.language", "tripleConstraint"), "tripleExpr", pushTo),
      PN_LOCAL_tripleExpr_predicate: PN_LOCAL(tag("variable", "tripleConstraint"), "tripleExpr", pushTo),
      IRI_tripleExprLabel: IRI("tripleExprLabel.value", "tripleExprLabel_IRI"),
      IRIREF_tripleExprLabel_IRI : IRIREF(tag("tripleExprLabel.constant.language", "IRIREF_tripleExprLabel_IRI"), "tripleExpr"),
      PN_LOCAL_tripleExprLabel_IRI: PN_LOCAL(tag("tripleExprLabel.value.variable", "PN_LOCAL_tripleExprLabel_IRI"), "tripleExpr"),
      IRI_tripleExprRef: IRI("tripleExprRef.value", "tripleExprRef_IRI"),
      IRIREF_tripleExprRef_IRI : IRIREF(tag("tripleExprRef.constant.language", "IRIREF_tripleExprRef_IRI"), "tripleExprEnd"),
      PN_LOCAL_tripleExprRef_IRI: PN_LOCAL(tag("tripleExprRef.value.variable", "PN_LOCAL_tripleExprRef_IRI"), "tripleExprEnd"),
      tripleExprEnd: [
        comments("tripleExprEnd"),
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
      IRI_tripleExpr_annotation_predicate: IRI("tripleExpr_annotation_predicate.value", "tripleExpr_annotation_predicate_IRI"),
      IRIREF_tripleExpr_annotation_predicate_IRI : IRIREF(tag("tripleExpr_annotation_predicate.constant.language", "IRIREF_tripleExpr_annotation_predicate_IRI"), "term_tripleExpr_annotation_object"),
      PN_LOCAL_tripleExpr_annotation_predicate_IRI: PN_LOCAL(tag("tripleExpr_annotation_predicate.value.variable", "PN_LOCAL_tripleExpr_annotation_predicate_IRI"), "term_tripleExpr_annotation_object"),
      term_tripleExpr_annotation_object: term("tripleExpr_annotation_object.value", "tripleExpr_annotation_object"),
      IRIREF_tripleExpr_annotation_object_IRI : IRIREF(tag("tripleExpr_annotation_object.constant.language", "IRIREF_tripleExpr_annotation_object_IRI"), "tripleExpr"),
      PN_LOCAL_tripleExpr_annotation_object_IRI: PN_LOCAL(tag("tripleExpr_annotation_object.value.variable", "PN_LOCAL_tripleExpr_annotation_object_IRI"), "tripleExpr"),
      qqstring_tripleExpr_annotation_object: STRING_LITERAL('"', tag("value.string", "qqstring_valueSet"), "IRI_valueSet_datatype", "langtag_valueSet_value", "valueSet"),
      qstring_tripleExpr_annotation_object : STRING_LITERAL("'", tag("value.string", "qqstring_valueSet"), "IRI_valueSet_datatype", "langtag_valueSet_value", "valueSet"),

      valueSet: [
        DocCommentHighlightRules.getStartRule("doc_valueSet-start"),
        comments("valueSet"),
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
          next: "IRIREF_valueSet_IRI"
        }, {
          token: tag("value.constant.library", "valueSet"),
          regex: PNAME_NS_RE,
          next: "PN_LOCAL_valueSet_IRI"
        },
      ],
      // IRIREF_valueSet_IRI : IRIREF((a,b,c) => { console.log("HGERE"); debugger; return tag("value.constant.language", "valueSet") }, "shapeExpr"),
      IRIREF_valueSet_IRI : IRIREF(tag("value.constant.language", "valueSet"), "valueSet"),
      PN_LOCAL_valueSet_IRI: PN_LOCAL(tag("value.variable", "valueSet"), "valueSet"),
      qqstring_valueSet: STRING_LITERAL('"', tag("value.string", "qqstring_valueSet"), "IRI_valueSet_datatype", "langtag_valueSet_value", "valueSet"),
      qstring_valueSet: STRING_LITERAL("'", tag("value.string", "qqstring_valueSet"), "IRI_valueSet_datatype", "langtag_valueSet_value", "valueSet"),
      IRI_valueSet_datatype: IRI(tag("value", "IRI_valueSet_datatype"), "IRI_valueSet_datatype"),
      langtag_valueSet_value: langtag(tag("value.string", "langtag_valueSet_value"), "valueSet"),
      IRIREF_IRI_valueSet_datatype : IRIREF(tag("constant.language", "value_datatype"), "valueSet"),
      PN_LOCAL_IRI_valueSet_datatype: PN_LOCAL(tag("value.variable", "value_datatype"), "valueSet"),
  };

debugger
    this.embedRules(DocCommentHighlightRules, "doc_start-",
        [ DocCommentHighlightRules.getEndRule("start") ]);

  this.embedRules(DocCommentHighlightRules, 'doc_shapeExpr-',
                  [ DocCommentHighlightRules.getEndRule('shapeExpr') ]);
  this.embedRules(DocCommentHighlightRules, 'doc_valueSet-',
                  [ DocCommentHighlightRules.getEndRule('valueSet') ]);
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

  function IRIREF_LT (self, token, next) { return [
    comments(self),
    addToken({
      regex : '<(?=.)',
      next: next
    }, token)
  ]}

  function IRI (token, next) {
    return [
      {
        token: token + ".whiteSpace",
        regex: '\\s+',
      }, {
        token: token + ".constant.language",
        regex: '<',
        next: "IRIREF_" + next
      }, {
        token: token + ".constant.library",
        regex: PNAME_NS_RE,
        next: "PN_LOCAL_"  + next
      },
    ]
  }

  function STRING_LITERAL (quote, token, datatype, langtag, next) {
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

  function term (token, next) {
    return IRI(token, next).concat(
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

  function langtag (token, next) {
    return [
      {
        token: token + ".meta",
        regex: LANGTAG_RE.substr(1), // already consumed the '@'
        next: next
      },
    ]
  }

  function IRIREF (token, next, push) {
    return [
        {
          token : token + ".escape",
          regex : UCHAR_RE
        }, {
          token : token + ".invalid",
          regex : UCHAR_BAD_RE
        }, addToken({
          regex : ">",
          next : next,
          push : push
        }, token), {
          defaultToken: token
        }
    ]
  }

  function PN_LOCAL (token, next, push) {
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

  function addToken (state, token) {
    return Object.assign(
      {},
      state,
      typeof token === 'function' ? {onMatch  : token} : {token  : token}
    )
  }

  oop.inherits(ShExCHighlightRules, TextHighlightRules);

  function comments(next) {
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
