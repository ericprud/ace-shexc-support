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

      // IRI
      {
        token: "function.constant.language",
        regex: '<',
        next: "IRIREF_shapeExprDecl"
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

  };
debugger
    this.embedRules(nestedShape("start", "start"), "", null);

    this.embedRules(DocCommentHighlightRules, "doc_start-",
        [ DocCommentHighlightRules.getEndRule("start") ]);

    this.embedRules(DocCommentHighlightRules, "doc_shapeExprDecl-",
        [ DocCommentHighlightRules.getEndRule("shapeExprDecl") ]);

    this.embedRules(DocCommentHighlightRules, "doc_valueSet-",
        [ DocCommentHighlightRules.getEndRule("valueSet") ]);

    this.normalizeRules();

  // {start:[
  //   {token: "comment.doc.tag", regex: "@[\\w\\d_]+"},
  //   {token: "comment.doc.tag.storage.type", regex: "\\b(?:TODO|FIXME|XXX|HACK)\\b"},
  //   {defaultToken: "comment.doc", caseInsensitive: true}
  // ]}
  
};

  function nestedShape (outer, inner) {
    return {
      PN_LOCAL_shapeExprLabel: [
        {
          token : "function.variable" + ".escape",
          regex : PN_LOCAL_ESC_RE
        }, {
          token : "function.variable" + ".escape",
          regex : PERCENT_RE
        }, {
          token : "function.variable",
          regex : "(?!" + PN_LOCAL_RE + ")", // is this sound and complete?
          next  : "shapeExprDecl"
        }, {
          defaultToken: "function.variable"
        }
      ],

      shapeExprDecl: [
        DocCommentHighlightRules.getStartRule("doc_shapeExprDecl-start"),
        comments("shapeExprDecl"),
        {
          token : "paren.lparen.shape",
          regex : /\{/,
          next  : "tripleExpr"
        },
        {
          token : "list.paren.lparen.valueSet",
          regex : /\[/,
          next  : "valueSet"
        },
        {
          token : "paren.lparen.shapeExpr",
          regex : /\(/,
          next  : "shapeExprDecl"
        },
      ],
      IRIREF_shapeExprDecl : IRIREF("function.constant.language", "shapeExprDecl"),

      tripleExpr: [
        // IRI
        {
          token: "constant.language",
          regex: '<',
          next: "IRIREF_shapeExprDecl_tripleExpr_predicate"
        }, {
          token: "tripleConstraint.constant.library",
          regex: PNAME_NS_RE,
          next: "PN_LOCAL_tripleExpr_predicate"
        },
        {
          token : "paren.rparen.shape",
          regex : /\}/,
          next  : outer
        },
      ],
      IRIREF_shapeExprDecl_tripleExpr_predicate : IRIREF("constant.language", "shapeExprDecl"),
      PN_LOCAL_tripleExpr_predicate: [
        {
          token : "tripleConstraint.variable" + ".escape",
          regex : PN_LOCAL_ESC_RE
        }, {
          token : "tripleConstraint.variable" + ".escape",
          regex : PERCENT_RE
        }, {
          token : "tripleConstraint.variable",
          regex : "(?!" + PN_LOCAL_RE + ")", // is this sound and complete?
          next  : "shapeExprDecl"
        }, {
          defaultToken: "tripleConstraint.variable"
        },
        {
          token : "paren.lparen.shape",
          regex : /\{/,
          next  : inner
        },      
      ],

      valueSet: [
        DocCommentHighlightRules.getStartRule("doc_valueSet-start"),
        comments("valueSet"),
        {
          token : "string",
          regex : "'(?=.)",
          next  : "qstring_valueSet"
        }, {
          token : "string",
          regex : '"(?=.)',
          next  : "qqstring_valueSet"
        }, {
          token : "list.paren.rparen.shape",
          regex : /\]/,
          next  : "tripleExpr"
        },
      ],
      qqstring_valueSet : [
        {
          token : "string.escape",
          regex : STRING_ESCAPE_RE
        }, {
          token : "invalid",
          regex : STRING_ESCAPE_BAD_RE
        }, {
          token : "string",
          regex : "\\\\$",
          consumeLineEnd  : true
        }, {
          token : "string",
          regex : '"|$',
          next  : "valueSet"
        }, {
          defaultToken: "string"
        }
      ],
      qstring_valueSet : [
        {
          token : "string.escape",
          regex : STRING_ESCAPE_RE
        }, {
          token : "invalid",
          regex : STRING_ESCAPE_BAD_RE
        }, {
          token : "string",
          regex : "\\\\$",
          consumeLineEnd  : true
        }, {
          token : "string",
          regex : "'|$",
          next  : "valueSet"
        }, {
          defaultToken: "string"
        }
      ],
    }
  }

  function IRIREF_LT (self, token, next) { return [
    comments(self),
    {
      token : token,
      regex : '<(?=.)',
      next  : next
    }
  ]}

  function IRIREF (token, next) {
    return [
        {
          token : token + ".escape",
          regex : UCHAR_RE
        }, {
          token : token + ".invalid",
          regex : UCHAR_BAD_RE
        }, {
          token : token,
          regex : ">|$",
          next  : next
        }, {
          defaultToken: token
        }
    ]
  }

oop.inherits(ShExCHighlightRules, TextHighlightRules);

function JSX() {
    var tagRegex = identifierRe.replace("\\d", "\\d\\-");
    var jsxTag = {
        onMatch : function(val, state, stack) {
            var offset = val.charAt(1) == "/" ? 2 : 1;
            if (offset == 1) {
                if (state != this.nextState)
                    stack.unshift(this.next, this.nextState, 0);
                else
                    stack.unshift(this.next);
                stack[2]++;
            } else if (offset == 2) {
                if (state == this.nextState) {
                    stack[1]--;
                    if (!stack[1] || stack[1] < 0) {
                        stack.shift();
                        stack.shift();
                    }
                }
            }
            return [{
                type: "meta.tag.punctuation." + (offset == 1 ? "" : "end-") + "tag-open.xml",
                value: val.slice(0, offset)
            }, {
                type: "meta.tag.tag-name.xml",
                value: val.substr(offset)
            }];
        },
        regex : "</?" + tagRegex + "",
        next: "jsxAttributes",
        nextState: "jsx"
    };
    this.$rules.start.unshift(jsxTag);
    var jsxJsRule = {
        regex: "{",
        token: "paren.quasi.start",
        push: "start"
    };
    this.$rules.jsx = [
        jsxJsRule,
        jsxTag,
        {include : "reference"},
        {defaultToken: "string"}
    ];
    this.$rules.jsxAttributes = [{
        token : "meta.tag.punctuation.tag-close.xml",
        regex : "/?>",
        onMatch : function(value, currentState, stack) {
            if (currentState == stack[0])
                stack.shift();
            if (value.length == 2) {
                if (stack[0] == this.nextState)
                    stack[1]--;
                if (!stack[1] || stack[1] < 0) {
                    stack.splice(0, 2);
                }
            }
            this.next = stack[0] || "start";
            return [{type: this.token, value: value}];
        },
        nextState: "jsx"
    },
    jsxJsRule,
    comments("jsxAttributes"),
    {
        token : "entity.other.attribute-name.xml",
        regex : tagRegex
    }, {
        token : "keyword.operator.attribute-equals.xml",
        regex : "="
    }, {
        token : "text.tag-whitespace.xml",
        regex : "\\s+"
    }, {
        token : "string.attribute-value.xml",
        regex : "'",
        stateName : "jsx_attr_q",
        push : [
            {token : "string.attribute-value.xml", regex: "'", next: "pop"},
            {include : "reference"},
            {defaultToken : "string.attribute-value.xml"}
        ]
    }, {
        token : "string.attribute-value.xml",
        regex : '"',
        stateName : "jsx_attr_qq",
        push : [
            {token : "string.attribute-value.xml", regex: '"', next: "pop"},
            {include : "reference"},
            {defaultToken : "string.attribute-value.xml"}
        ]
    },
    jsxTag
    ];
    this.$rules.reference = [{
        token : "constant.language.escape.reference.xml",
        regex : "(?:&#[0-9]+;)|(?:&#x[0-9a-fA-F]+;)|(?:&[a-zA-Z0-9_:\\.-]+;)"
    }];
}

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
