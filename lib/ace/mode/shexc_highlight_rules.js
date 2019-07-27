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
   .ace_semAct { line-height: 1.7ex; vertical-align: top; border-bottom: .3ex solid #c7e0d7; }
   .ace_escape { font-weight: bold; }
 */

define(function(require, exports, module) {
"use strict";

  const oop = require("../lib/oop");
  const DocCommentHighlightRules = require("./doc_comment_highlight_rules").DocCommentHighlightRules;
  const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

  /** terminals from <http://shex.io/shex-semantics/index.html#term-IRIREF>
   * <IRIREF>      ::=          "<" ([^#0000- <>\"{}|^`\\] | UCHAR)* ">"
   * <PNAME_NS>	   ::=   	PN_PREFIX? ":"
   * <PNAME_LN>	   ::=   	PNAME_NS PN_LOCAL
   * ... (see link for the rest)
   */
  const HEX_RE = '[0-9a-fA-F]'
  const UCHAR_RE = '\\\\(?:u' + HEX_RE + '{4}|U' + HEX_RE + '{8})'
  const UCHAR_BAD_RE = '\\\\(?:u' + HEX_RE + '{0,4}|U' + HEX_RE + '{0,8})'
  const ECHAR_RE = '\\\\[tbnrf\\\\"\']'
  const ECHAR_BAD_RE = '\\\\[^tbnrf\\\\"\']'
  const STRING_ESCAPE_RE = '(?:' + ECHAR_RE + '|' + UCHAR_RE + ')'
  const STRING_ESCAPE_BAD_RE = '(?:' + ECHAR_BAD_RE + '|' + UCHAR_BAD_RE + ')'
  const PN_CHARS_BASE_RE = '(?:[a-zA-Z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]|[\uD800-\uDB7F][\uDC00-\uDFFF])' // last is UTF16 for \U00010000-\U000EFFFF
  const PN_CHARS_U_RE = [PN_CHARS_BASE_RE, '_'].join('|')
  const PN_CHARS_RE = '(?:' + [PN_CHARS_U_RE, '-', '[0-9\u00B7\u0300-\u036F\u203F-\u2040]'].join('|') + ')'
  const PN_PREFIX_RE = PN_CHARS_BASE_RE + '(?:(?:' + PN_CHARS_RE + '|\\.)*' + PN_CHARS_RE + ')?'
  const PNAME_NS_RE = '(?:' + PN_PREFIX_RE + ')?:'
  const BLANK_NODE_LABEL_RE = '_:(?:' + PN_CHARS_U_RE + '|[0-9])(?:(?:' + PN_CHARS_RE + '|\\.)*' + PN_CHARS_RE + ')?'
  const LANGTAG_RE = /@[a-zA-Z]+(?:-[a-zA-Z0-9]+)*/
  const INTEGER_RE = /[0-9]+/
  const DECIMAL_RE = /[+-]?[0-9]*\.[0-9]+/
  const DOUBLE_RE = /[+-]?(?:[0-9]+\.[0-9]*[eE][+-]?[0-9]+|\.?[0-9]+[eE][+-]?[0-9]+)/
  const PN_LOCAL_ESC_RE = '\\\\[_~.!$&\'()*+,;=/?#@%-]'
  const PERCENT_RE = '%' + HEX_RE + HEX_RE
  const PERCENT_BAD_RE = '%' + HEX_RE + '{0,2}'
  const PLX_RE = [PERCENT_RE, PN_LOCAL_ESC_RE].join('|')
  const PN_LOCAL_RE = '(?:' + [PN_CHARS_U_RE, ':', '[0-9]', PLX_RE].join('|') + ')'
      + '(?:' + '(?:' + [PN_CHARS_RE, '\\.', ':', PLX_RE].join('|') + ')' + ')*'
  const PNAME_LN_RE = PNAME_NS_RE + PN_LOCAL_RE
  /** IRI forms from <https://shexspec.github.io/spec/#prod-iri>
   * iri	   ::=   	IRIREF | prefixedName
   * prefixedName  ::=   	PNAME_LN | PNAME_NS
   * ... (see link for the rest)
   */
  const PERCENT = { className: 'meta-keyword', begin: PERCENT_RE }
  const UCHAR = { className: 'meta-keyword', begin: UCHAR_RE }
  const PN_LOCAL_ESC = { className: 'meta-keyword', begin: PN_LOCAL_ESC_RE }

  const CODE_RE = '\\{(?:[^%\\\\]|\\\\[%\\\\]|' + UCHAR_RE + ')*%\\}'
  const cardinality_RE = /[*+?]|\{[0-9]+(?:,(?:[0-9]+|\*)?)?\}/
  const booleanLiteral_RE = /true|false/


  const ShExCHighlightRules = function(options) {
    // see: http://shex.io/

    const allInvalid = [ { regex: /\s+/, token: "whiteSpace" }, { regex: /./, token: "invalid" } ]

    const iri_LA = lookAhead('<', PNAME_NS_RE)
    const valueSet_RE = '\\['
    const litNodeKind = anyCase("LITERAL")
    const nonLitNodeKind = anyCase("IRI", "BNODE", "NONLITERAL")
    const stringLength = anyCase("Length", "MinLength", "MaxLength")
    const numericRange = anyCase("MinInclusive", "MinExclusive", "MaxInclusive", "MaxExclusive")
    const numericLength = anyCase("TotalDigits", "FractionDigits")

    const nonLitNodeConstraint_LA = lookAhead(nonLitNodeKind, stringLength, "\\/(?!/)")
    const litNodeConstraint_LA = lookAhead(litNodeKind, iri_LA, valueSet_RE, numericRange, numericLength)
    const shapeDefinition_LA = lookAhead(anyCase("EXTRA", "CLOSED"), '\\{')
    const shapeOrRef_LA = lookAhead(shapeDefinition_LA, "@")

    // rules are constructed inside an Object.assign to include object
    // constructors like nottableAtom("nested_")
    this.$rules = Object.assign(
      { start: [ { regex: /(?:)/, next: "shexDoc" } ],
        shexDoc: [
          { regex: anyCase("PREFIX"), token: "keyword", push: "prefix_PNAME_NS" }, // IRIREF will pop
          { regex: anyCase("BASE", "IMPORT"), token: "keyword", push: "IRIREF" },
          { regex: BLANK_NODE_LABEL_RE, token: "bnode.shapeExprLabel", next: "shapeExprOrExternal" },
          { regex: /%/, token: "semAct.keyword", push: "semActIRI", next: "shexDoc" },
          { regex: anyCase("START"), token: "keyword", next: "started" },
          iri(".function.shapeExprLabel", { next: "shapeExprOrExternal" }),
          allInvalid
        ],
        started: [
          { regex: /\s+/, token: "whiteSpace" },
          { regex: /=/, token: "operator", push: "shapeNot", next: "shexDoc" },
        ],
        prefix_PNAME_NS: [
          { regex: PNAME_NS_RE, token: "constant.library", next: "IRIREF" },
          allInvalid
        ],
        IRIREF: IRIREF(""), // for PREFIX decls
        shapeExprOrExternal: [
          { regex: /\s+/, token: "whiteSpace" },
          { regex: anyCase("EXTERNAL"), token: "keyword", next: "shexDoc" },
          { regex: /(?:)/, push: "shapeNot", next: "shexDoc" }
        ]
      },

      // shapeOr, shapeAnd, shapeNot, shapeAtom outside ()s
      nottableAtom(""),
      { andOrOpt: [
        { regex: /\/\//, token: "annotation.meta.shapeExpr", push: "annotationPredicate", next: "andOrOpt" },
        { regex: /%/, token: "semAct.keyword", push: "semActIRI", next: "andOrOpt" },
        { regex: anyCase("AND", "OR"), token: "keyword", next: "shapeNot" },
        { regex: /\s+/, token: "whiteSpace" },
        { regex: /(?:)/, next: "pop" }
      ] },

      // shapeOr, shapeAnd, shapeNot, shapeAtom inside ()s
      nottableAtom("nested_"),
      { nested_andOrOpt: [
        { regex: /\/\//, token: "annotation.meta.shapeExpr", push: "annotationPredicate", next: "nested_andOrOpt" },
        { regex: /%/, token: "semAct.keyword", push: "semActIRI", next: "nested_andOrOpt" },
        { regex: anyCase("AND", "OR"), token: "keyword", next: "nested_shapeNot" },
        { regex: /\)/, token: "rparen", next: "pop" },
        allInvalid
      ] },

      { shapeRef: [
        { regex: BLANK_NODE_LABEL_RE, token: "bnode.shapeExprRef", next: "pop" },
        iri(".atom.shapeExprRef", {next: "pop" }),
        allInvalid
      ] },


      { shape: [
        { regex: anyCase("CLOSED"), token: "keyword"},
        { regex: anyCase("EXTRA"), token: "keyword", next: "extra" },
        { regex: /\{/, token: "lcurly", next: "tripleExpression" },
        allInvalid
      ],
        extra: [ // TODO: EXTRA { ... } is illegal but what should we mark invalid?
          { regex: "(?=" + anyCase("CLOSED") + ")", next: "shape" },
          { regex: anyCase("EXTRA"), token: "keyword", next: "extra" },
          { regex: "(?=\{)", next: "shape" },
          iri("", { next: "extra" }),
          allInvalid
        ] },

      { tripleExpression: [
          iri(".atom.predicate", { push: "shapeNot", next: "eachOneOpt" }),
          { regex: /\^/, token: "operator", next: "tripleExpression" },
          { regex: /\ba\b/, token: "constant.language.atom.predicate", push: "shapeNot", next: "eachOneOpt" },
          { regex: /\$/, token: "operator", push: "tripleExprLabel", next: "tripleExpression" },
          { regex: /&/, token: "operator", push: "inclusion", next: "eachOneOpt" },
          { regex: /\(/, token: "lparen", push: "bracketedTripleExpr", next: "eachOneOpt" },
          { regex: /\}/, token: "rcurly", next: "pop" },
          allInvalid
        ],
        eachOneOpt: [
          { regex: cardinality_RE, token: "constant", next: "eachOneOpt" },
          { regex: /\/\//, token: "annotation.meta.shapeExpr", push: "annotationPredicate", next: "eachOneOpt" },
          { regex: /%/, token: "semAct.keyword", push: "semActIRI", next: "eachOneOpt" },
          { regex: /;/, token: "operator", next: "orOpt" },
          { regex: /\|/, token: "operator", next: "tripleExpression" },
          { regex: /\s+/, token: "whiteSpace", next: "eachOneOpt" },
          { regex: /\}/, token: "rcurly", next: "pop" },
          allInvalid
        ],
        orOpt: [
          { regex: /\s+/, token: "whiteSpace", next: "orOpt" },
          { regex: /\|/, token: "operator", next: "tripleExpression" },
          { regex: /(?:)/, next: "tripleExpression" }
        ],

        bracketedTripleExpr: [
          iri(".atom.predicate", { push: "shapeNot", next: "bracketedEachOneOpt" }),
          { regex: /\^/, token: "operator", next: "bracketedTripleExpr" },
          { regex: /\ba\b/, token: "constant.language.atom.predicate", push: "shapeNot", next: "bracketedEachOneOpt" },
          { regex: /\$/, token: "operator", push: "tripleExprLabel", next: "bracketedTripleExpr" },
          { regex: /&/, token: "operator", push: "inclusion", next: "bracketedEachOneOpt" },
          { regex: /\(/, token: "lparen", push: "bracketedTripleExpr", next: "bracketedEachOneOpt" },
          { regex: /\}/, token: "invalid", next: "pop" }, // error state. TODO: pop all the way to "shape"
          allInvalid
        ],
        bracketedEachOneOpt: [
          { regex: cardinality_RE, token: "constant", next: "bracketedEachOneOpt" },
          { regex: /\/\//, token: "annotation.meta.shapeExpr", push: "annotationPredicate", next: "bracketedEachOneOpt" },
          { regex: /%/, token: "semAct.keyword", push: "semActIRI", next: "bracketedEachOneOpt" },
          { regex: /;/, token: "operator", next: "bracketedOrOpt" },
          { regex: /\|/, token: "operator", next: "bracketedTripleExpr" },
          { regex: /\s+/, token: "whiteSpace", next: "bracketedEachOneOpt" },
          { regex: /\)/, token: "rparen", next: "pop" },
          allInvalid
        ],
        bracketedOrOpt: [
          { regex: /\s+/, token: "whiteSpace", next: "bracketedOrOpt" },
          { regex: /\|/, token: "operator", next: "bracketedTripleExpr" },
          { regex: /\)/, token: "rparen", next: "pop" },
          { regex: /(?:)/, next: "bracketedTripleExpr" }
        ],

        tripleExprLabel: [
          { regex: BLANK_NODE_LABEL_RE, token: "bnode.tripleExprLabel", next: "pop" },
          iri(".atom.tripleExprLabel", { next: "pop" } ),
          allInvalid
        ],

        inclusion: [
          { regex: BLANK_NODE_LABEL_RE, token: "bnode.tripleExprRef", next: "pop" },
          iri(".atom.tripleExprRef", { next: "pop" } ),
          allInvalid
        ],

        valueSet: [
          { regex: /\]/, token: "operator", next: "pop" },
          { regex: /\./, token: "keyword", next: "valueSet" },
          { regex: /[~-]/, token: "operator", next: "valueSet" },
          iri(".valueSetValue", { next: "valueSet" } ),
          literal("value.string.valueSetValue", { next: "valueSet" } ),
          { regex: LANGTAG_RE, token: "meta.langtag", next: "valueSet" },
          { regex: /@/, token: "meta.langtag", next: "valueSet" },
          allInvalid
        ],

        annotationPredicate: [
          { regex: /\s+/, token: "whiteSpace.annotation" },
          iri(".annotation.predicate", { next: "annotationObject" }),
          { regex: /\ba\b/, token: "constant.language.annotation.predicate", next: "annotationObject" },
          allInvalid
        ],
        annotationObject: [
          { regex: /\s+/, token: "whiteSpace.annotation" },
          iri(".annotation.object", { next: "pop" }),
          literal(".annotation.object", { next: "pop" } ),
          allInvalid
        ],

        semActIRI: [
          { regex: /\s+/, token: "whiteSpace.semAct" },
          iri(".annotation.semActName", { next: "semActCode" }),
          allInvalid
        ],
        semActCode: [
          { regex: /\s+/, token: "whiteSpace.semAct" },
          { regex: CODE_RE, token: "semAct", next: "pop" },
          { regex: /%/, token: "semAct", next: "pop" },
          allInvalid
        ],

        integer: [
          { regex: INTEGER_RE, token: "constant", next: "pop" },
          allInvalid
        ],
        numeric: [
          { regex: DOUBLE_RE, token: "constant", next: "pop" },
          { regex: DECIMAL_RE, token: "constant", next: "pop" },
          { regex: INTEGER_RE, token: "constant", next: "pop" },
          allInvalid
        ],

        // from javascript_highlight_rules.js
        regex: [
          {
            // escapes
            token: "regexp.keyword.operator",
            regex: "\\\\(?:u[\\da-fA-F]{4}|x[\\da-fA-F]{2}|.)"
          }, {
            // flag
            token: "string.regexp",
            regex: "/[sxngimy]*",
            next: "pop"
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
            next: "pop"
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
            next: "pop"
          }, {
            defaultToken: "string.regexp.charachterclass"
          }
        ]
      }
    )

    // Enable comments for each named production except those in noCommentList.
    // Debugging note: this adds 1 to the indexes of the above rules before
    // normalizeRules() and 3 after.
    const noCommentList = ["start", "regex", "regex_character_class"]
    Object.keys(this.$rules)
      .filter(name => noCommentList.indexOf(name) === -1)
      .forEach(name => addComments(this.$rules[name]))
    this.normalizeRules()
    // embedStateDebuggingInfo(this.$rules)

    return

    // support functions below here

    /** implement the shapeNot and shapeAtoms productions
     * @use: nottableAtom(""), nottableAtom("nested_"),
     */
    function nottableAtom (leader = "") {
      const ret = {  }
      ret[leader + "shapeNot"] = [
        { regex: /\s/, token: "whiteSpace" },
        { regex: anyCase("NOT"), token: "keyword", next: leader + "shapeAtom" },
        { regex: /(?:)/, next: leader + "shapeAtom" }
      ]
      ret[leader + "shapeAtom"] = [
        { regex: nonLitNodeConstraint_LA, token: "keyword", push: leader + "nonLitNodeConstraint", next: leader + "shapeOrRefOpt" },
        { regex: litNodeConstraint_LA, token: "keyword", push: leader + "litNodeConstraint", next: leader + "andOrOpt" },
        { regex: shapeDefinition_LA, token: "keyword", push: "shape", next: leader + "nonLitNodeConstraintOpt" },
        { regex: /@/, token: "operator", push: "shapeRef", next: leader + "nonLitNodeConstraintOpt" },
        { regex: /\(/, token: "lparen", push: "nested_shapeNot", next: leader + "andOrOpt" },
        { regex: /\./, token: "keyword.atom", next: leader + "andOrOpt" },
        allInvalid
      ]
      ret[leader + "nonLitNodeConstraint"] = [
        { regex: nonLitNodeKind, token: "keyword", next: leader + "stringFacetStar" },
        { regex: stringLength, token: "keyword", push: "integer", next: leader + "stringFacetStar" },
        { regex: "\\/(?!/)", token: "string.regexp", push: "regex", next: leader + "stringFacetStar" },
        allInvalid
      ]
      ret[leader + "nonLitNodeConstraintOpt"] = [
        { regex: nonLitNodeKind, token: "keyword", next: leader + "andOrOpt" },
        { regex: stringLength, token: "keyword", push: "integer", next: leader + "andOrOpt" },
        { regex: "\\/(?!/)", token: "string.regexp", push: "regex", next: leader + "andOrOpt" },
        { regex: /(?:)/, next: leader + "andOrOpt" }
      ]
      ret[leader + "litNodeConstraint"] = [
        { regex: litNodeKind, token: "keyword", next: leader + "xsFacetStar" },
        iri(".atom.datatype", { next: leader + "xsFacetStar" }),
        { regex: /\[/, token: "operator", push: "valueSet", next: leader + "xsFacetStar" },
        { regex: numericRange, token: "keyword", push: "numeric" },
        { regex: numericLength, token: "keyword", push: "integer", next: leader + "xsFacetStar" },
        allInvalid
      ]
      ret[leader + "shapeOrRefOpt"] = [
        { regex: shapeDefinition_LA, token: "keyword", push: "shape", next: leader + "andOrOpt" },
        { regex: /@/, token: "operator", push: "shapeRef", next: leader + "andOrOpt" },
        { regex: /(?:)/, next: leader + "andOrOpt" }
      ]
      ret[leader + "stringFacetStar"] = [
        { regex: /\s/, token: "whiteSpace" },
        { regex: stringLength, token: "keyword", push: "integer", next: leader + "stringFacetStar" },
        { regex: "\\/(?!/)", token: "string.regexp", push: "regex", next: leader + "stringFacetStar" },
        { regex: /(?:)/, next: "pop" }
      ]
      ret[leader + "xsFacetStar"] = [
        { regex: /\s/, token: "whiteSpace" },
        { regex: stringLength, token: "keyword", push: "integer", next: leader + "xsFacetStar" },
        { regex: "\\/(?!/)", token: "string.regexp", push: "regex", next: leader + "xsFacetStar" },
        { regex: numericRange, token: "keyword", push: "numeric", next: leader + "xsFacetStar" },
        { regex: numericLength, token: "keyword", push: "integer", next: leader + "xsFacetStar" },
        { regex: /(?:)/, next: "pop" }
      ]
      return ret
    }

    /** add comment rules to a passed list of rules
     */
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

    /** accept a relative or prefixed IRI
     * @param next: object with e.g. next and/or push properties
     * @use: iri({next: "shexDoc", push: "shapeAtom"}),
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
          { regex : /-/, token: "variable" + token }, // 'cause (?!PN_LOCAL_RE) doesn't work so well
          Object.assign({ regex : "(?!" + PN_LOCAL_RE + ")", token: "variable" + token }, next), // TODO: is this sound and complete?
          { defaultToken: "variable" + token }
        ] },
      ]
    }

    /** accept a relative IRI
     */
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

    /** accept a literal
     * @param next: object with e.g. next and/or push properties
     * @use: literal("token", {next: "shexDoc", push: "shapeAtom"}),
     */
    function literal (token, next) {
      return [
        { regex: /"/, token: token, next: [
          { regex: STRING_ESCAPE_RE, token : token + ".escape" },
          { regex: STRING_ESCAPE_BAD_RE, token : "invalid" },
          { regex: /"/, token: token, next: [
            Object.assign({ regex: LANGTAG_RE, token: token}, next),
            { regex: /\^\^/, token: token, next: [
              iri(token + ".datatype", next ),
              allInvalid
            ] },
            Object.assign({ regex : "(?:)", token: "constant.language" + token }, next),
          ] },
          { defaultToken: "constant.language" + token }
        ] },
        { regex: /'/, token: token, next: [
          { regex: STRING_ESCAPE_RE, token : token + ".escape" },
          { regex: STRING_ESCAPE_BAD_RE, token : "invalid" },
          { regex: /'/, token: token, next: [
            Object.assign({ regex: LANGTAG_RE, token: token}, next),
            { regex: /\^\^/, token: token, next: [
              iri(token + ".datatype", next ),
              allInvalid
            ] },
            Object.assign({ regex : "(?:)", token: "constant.language" + token }, next),
          ] },
          { defaultToken: "constant.language" + token }
        ] },
        Object.assign({ regex: DOUBLE_RE, token: "constant" }, next),
        Object.assign({ regex: DECIMAL_RE, token: "constant" }, next),
        Object.assign({ regex: INTEGER_RE, token: "constant" }, next),
        Object.assign({ regex: booleanLiteral_RE, token: "constant" }, next),
      ]
    }

    /** create case-insensitive regexp
     * anyCase("AB", "CD") => /\b(?:[Aa][Bb]|[Cc][Dd])\b/
     */
    function anyCase () {
      const args = Array.from(arguments)
      return "\\b(?:"+args.map(
        arg => [].map.call(
          arg, ch => "[" + ch.toUpperCase() + ch.toLowerCase() + "]"
        ).join("")
      ).join("|")+")\\b"
    }

    /** match but don't consume arguments.
     * lookAhead("as", "df") => /(?=ab|cd)/
     */
    function lookAhead () {
      const args = Array.from(arguments)
      return "(?="+args.join("|")+")"
    }

    /** add debugging info to the class.
     * This works well with kitchen-sink's [Show token info].
     */
    function embedStateDebuggingInfo (grammar) {
      Object.values(grammar).forEach(
        rules =>
          rules.forEach(
            rule =>
              rule.onMatch = function (matched, currentState, stack) {
                console.log(this, matched, currentState, stack)
                return this.token + "\n" + currentState + "\n(" + stack.join("|") + ")\n" + JSON.stringify(rule, null, 2)
              }
          )
      )
    }
  }

  oop.inherits(ShExCHighlightRules, TextHighlightRules)
  exports.ShExCHighlightRules = ShExCHighlightRules
})
