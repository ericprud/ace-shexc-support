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

define(function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var DocCommentHighlightRules = require("./doc_comment_highlight_rules").DocCommentHighlightRules;
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

// TODO: Unicode escape sequences
var identifierRe = "[a-zA-Z\\$_\u00a1-\uffff][a-zA-Z\\d\\$_\u00a1-\uffff]*";

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
    var keywordMapper = this.createKeywordMapper({
      "variable.language": "and|or||not|extra|closed|extends|" ,
      "keyword": "mininclusive|maxinclusive|minexclusive|maxexclusive|minlength|maxlength",
      "support.function":
      "alert",
      "constant.language.boolean": "true|false"
    }, "identifier", true);

  const pushTo = 'shapeExprDecl'
  const popFrom = 'tripleExpr'

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
        token: "function.constant.language",
        regex: '<',
        next: "IRIREF_shapeExprLabel"
      }, {
        token: "function.constant.library",
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

    IRIREF_shapeExprLabel : IRIREF("function.constant.language", "0-" + pushTo),
    PN_LOCAL_shapeExprLabel: PN_LOCAL(tag3("function.variable", "shapeExprLabel", "start"), "0-" + pushTo),

  };

debugger
    this.embedRules(DocCommentHighlightRules, "doc_start-",
        [ DocCommentHighlightRules.getEndRule("start") ]);

  const rules = this.$rules
  this.embedRules(nestedShape("@@outer@@", "0-", "@@inner@@"), "0-");
  fixup(rules, '0-', '@@outer@@', 'start')
  fixup(rules, '0-', '@@inner@@', '1-' + pushTo)
  this.embedRules(DocCommentHighlightRules, '0-doc_shapeExprDecl-',
                  [ DocCommentHighlightRules.getEndRule('0-shapeExprDecl') ]);
  this.embedRules(DocCommentHighlightRules, '0-doc_valueSet-',
                  [ DocCommentHighlightRules.getEndRule('0-valueSet') ]);


  this.embedRules(nestedShape("@@outer@@", "1-", "@@inner@@", "@@outer2@@"), "1-");
  fixup(rules, '1-', '@@outer@@', '0-' + popFrom)
  fixup(rules, '1-', '@@outer2@@', 'start')
  fixup(rules, '1-', '@@inner@@', '2-' + pushTo)
  this.embedRules(DocCommentHighlightRules, "1-doc_shapeExprDecl-",
                  [ DocCommentHighlightRules.getEndRule("1-shapeExprDecl") ]);
  this.embedRules(DocCommentHighlightRules, "1-doc_valueSet-",
                  [ DocCommentHighlightRules.getEndRule("1-valueSet") ]);


  this.embedRules(nestedShape("@@outer@@", "2-", "@@inner@@"), "2-");
  fixup(rules, '2-', '@@outer@@', '1-' + popFrom)
  fixup(rules, '2-', '@@inner@@', '3-' + pushTo)
  this.embedRules(DocCommentHighlightRules, "2-doc_shapeExprDecl-",
                  [ DocCommentHighlightRules.getEndRule("2-shapeExprDecl") ]);
  this.embedRules(DocCommentHighlightRules, "2-doc_valueSet-",
                  [ DocCommentHighlightRules.getEndRule("2-valueSet") ]);


  this.embedRules(nestedShape("@@outer@@", "3-", "@@inner@@"), "3-");
  fixup(rules, '3-', '@@outer@@', '2-' + popFrom)
  fixup(rules, '3-', '@@inner@@', '4-' + pushTo)
  this.embedRules(DocCommentHighlightRules, "3-doc_shapeExprDecl-",
                  [ DocCommentHighlightRules.getEndRule("3-shapeExprDecl") ]);
  this.embedRules(DocCommentHighlightRules, "3-doc_valueSet-",
                  [ DocCommentHighlightRules.getEndRule("3-valueSet") ]);


  this.embedRules(nestedShape("@@outer@@", "4-", "@@inner@@"), "4-");
  fixup(rules, '4-', '@@outer@@', '3-' + popFrom)
  fixup(rules, '4-', '@@inner@@', '5-' + pushTo)
  this.embedRules(DocCommentHighlightRules, "4-doc_shapeExprDecl-",
                  [ DocCommentHighlightRules.getEndRule("4-shapeExprDecl") ]);
  this.embedRules(DocCommentHighlightRules, "4-doc_valueSet-",
                  [ DocCommentHighlightRules.getEndRule("4-valueSet") ]);


  this.embedRules(nestedShape("@@outer@@", "5-", "@@inner@@"), "5-");
  fixup(rules, '5-', '@@outer@@', '4-' + popFrom)
  fixup(rules, '5-', '@@inner@@', '6-' + pushTo)
  this.embedRules(DocCommentHighlightRules, "5-doc_shapeExprDecl-",
                  [ DocCommentHighlightRules.getEndRule("5-shapeExprDecl") ]);
  this.embedRules(DocCommentHighlightRules, "5-doc_valueSet-",
                  [ DocCommentHighlightRules.getEndRule("5-valueSet") ]);


  this.normalizeRules();

  // {start:[
  //   {token: "comment.doc.tag", regex: "@[\\w\\d_]+"},
  //   {token: "comment.doc.tag.storage.type", regex: "\\b(?:TODO|FIXME|XXX|HACK)\\b"},
  //   {defaultToken: "comment.doc", caseInsensitive: true}
  // ]}
  
};

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

  function nestedShape (outer, self, inner, outer2) {
    return {
      shapeExprDecl: [
        DocCommentHighlightRules.getStartRule("doc_shapeExprDecl-start"),
        comments(self + "shapeExprDecl"),
        {
          token : "operator",
          // onMatch: function (a,b,c) { debugger; return this.token + '.' + this.next },
          regex : /[.;](\s*;)*/,
          next  : outer
        },
        {
          token : tag("paren.lparen.shape", "shapeExprDecl"),
          regex : /\{/,
          next  : "tripleExpr"
        },
        {
          onMatch: function () { debugger; return this.token },
          token : tag("paren.rparen.shape", "shapeExprDecl"),
          regex : /\}/,
          next  : outer2
        },
        {
          token : tag("list.paren.lparen", "valueSet"),
          regex : /\[/,
          next  : "valueSet"
        },
        {
          token : tag("paren.lparen", "shapeExpr"),
          regex : /\(/,
          next  : "shapeExprDecl"
        },
        {
          token : tag("paren.rparen", "shapeExpr"),
          regex : /\)/,
          next  : "shapeExprDecl"
        },

        // datatype IRI
        {
          // onMatch: function () { debugger; return this.token },
          token: tag("constant.language", "datatype"),
          regex: '<',
          next: "IRIREF_datatype"
        }, {
          token: tag("constant.library", "datatype"),
          regex: PNAME_NS_RE,
          next: "PN_LOCAL_datatype"
        },
      ],
      // IRIREF_shapeExprDecl_datatype : IRIREF((a,b,c) => { debugger; return tag("constant.language", "datatype") }, "shapeExprDecl"),
      IRIREF_datatype : IRIREF(tag("constant.language", "datatype"), "shapeExprDecl"),
      PN_LOCAL_datatype: PN_LOCAL(tag("variable", "datatype"), "shapeExprDecl"),

      tripleExpr: [
        {
          token : "paren.rparen.shape",
          regex : /\}/,
          next  : outer
        },
        // {
        //   token : "paren.lparen.shape.INNER",
        //   regex : /\{/,
        //   next  : inner
        // },
        comments(self + "tripleExpr"),

        // predicate IRI
        {
          // onMatch: function () { debugger; return this.token },
          token: tag("constant.language", "tripleConstraint"),
          regex: '<',
          next: "IRIREF_shapeExprDecl_tripleExpr_predicate"
        }, {
          token: tag("constant.library", "tripleConstraint"),
          regex: PNAME_NS_RE,
          next: "PN_LOCAL_tripleExpr_predicate"
        },
      ],
      // IRIREF_shapeExprDecl_tripleExpr_predicate : IRIREF((a,b,c) => { debugger; return tag("constant.language", "tripleConstraint") }, inner),
      IRIREF_shapeExprDecl_tripleExpr_predicate : IRIREF(tag("constant.language", "tripleConstraint"), inner),
      PN_LOCAL_tripleExpr_predicate: PN_LOCAL(tag("variable", "tripleConstraint"), inner),

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
          next  : "shapeExprDecl"
        },

        // value IRI
        {
          // onMatch: function () { debugger; return this.token },
          token: tag("constant.language", "value"),
          regex: '<',
          next: "IRIREF_valueSet_IRI"
        }, {
          token: tag("constant.library", "value"),
          regex: PNAME_NS_RE,
          next: "PN_LOCAL_valueSet_IRI"
        },
      ],
      // IRIREF_valueSet_IRI : IRIREF((a,b,c) => { debugger; return tag("constant.language", "value") }, "shapeExprDecl"),
      IRIREF_valueSet_IRI : IRIREF(tag("constant.language", "value"), "shapeExprDecl"),
      PN_LOCAL_valueSet_IRI: PN_LOCAL(tag("variable", "value"), "shapeExprDecl"),
      qqstring_valueSet : [
        {
          token : tag("string.escape", "qqstring_valueSet"),
          regex : STRING_ESCAPE_RE
        }, {
          token : "invalid",
          regex : STRING_ESCAPE_BAD_RE
        }, {
          token : "value.string",
          regex : "\\\\$",
          consumeLineEnd  : true
        }, {
          token : tag("value.string", "qqstring_valueSet"),
          regex : '"|$',
          next  : "valueSet"
        }, {
          defaultToken: tag("value.string", "qqstring_valueSet"),
        }
      ],
      qstring_valueSet : [
        {
          token : tag("string.escape", "qstring_valueSet"),
          regex : STRING_ESCAPE_RE
        }, {
          token : "invalid",
          regex : STRING_ESCAPE_BAD_RE
        }, {
          token : tag("value.string", "qstring_valueSet"),
          regex : "\\\\$",
          consumeLineEnd  : true
        }, {
          token : tag("value.string", "qstring_valueSet"),
          regex : "'|$",
          next  : "valueSet"
        }, {
          defaultToken: tag("value.string", "qstring_valueSet")
        }
      ],
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

  function IRIREF (token, next) {
    return [
        {
          token : token + ".escape",
          regex : UCHAR_RE
        }, {
          token : token + ".invalid",
          regex : UCHAR_BAD_RE
        }, addToken({
          regex : ">|$",
          next: next
        }, token), {
          defaultToken: token
        }
    ]
  }

  function PN_LOCAL (token, next) {
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
        next  : next
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
