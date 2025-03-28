/**
 * @ngdoc overview
 * @name es.Web.UI
 * @module es.Web.UI
 * @kind module
 * @description
 * This module encapsulates a set of directives, filters, services and methods for UI
 */

(function () {
    "use strict";
    var esWEBUI = angular.module("es.Web.UI", [
        "ngAnimate",
        "ui.bootstrap",
        "ngSanitize",
        "pascalprecht.translate",
        "dx",
        "angular-clipboard",
    ]);

    esWEBUI.run([
        "$translate",
        "esMessaging",
        "$q",
        "$http",
        "$injector",
        function ($translate, esMessaging, $q, $http, $injector) {
            window.esLoginLanguage =
                navigator.language || navigator.userLanguage || "en-US";

            esMessaging.subscribe("AUTH_CHANGED", function (sess, apitoken) {
                var lang =
                    sess && sess.connectionModel && sess.connectionModel.LangID
                        ? sess.connectionModel.LangID
                        : window.esLoginLanguage;

                doChangeLanguage($translate, lang, $q, $http, $injector);

                if (sess && sess.connectionModel && apitoken) {
                    var api = $injector.get("esWebApi");
                    var esCache = $injector.get("esCache");
                    if (DevExpress && api && esCache) {
                        var x = esCache.getItem("ES_BASE_CURR");
                        if (x) {
                            DevExpress.config({ defaultCurrency: x });
                            return;
                        }

                        if (sess.connectionModel.IsExternal) {
                            DevExpress.config({ defaultCurrency: "EUR" });
                        } else {
                            api.getParameterValue("ESFICALYEARBASECURRENCY")
                                .then(function (ret) {
                                    esCache.setItem("ES_BASE_CURR", ret.data);
                                    DevExpress.config({
                                        defaultCurrency: ret.data,
                                    });
                                })
                                .catch(function (err) {});
                        }
                    }
                }
            });
        },
    ]);

    $(document).on("click.nav", ".navbar-collapse.in", function (e) {
        if ($(e.target).is("a")) {
            $(this).removeClass("in").addClass("collapse");
        }
    });

    function doChangeLanguage($translate, lang, $q, $http, $injector) {
        lang = lang || window.esLoginLanguage;
        var esCache = $injector.get("esCache");
        var aPart = lang.split("-")[0];

        var langURLPrefix = window.ESIsB2B ? "/assets/collab/" : "";

        $translate.use(aPart);

        if (Globalize) {
            if (!esCache.getItem("Globalize_" + lang)) {
                $q.all([
                    $http.get(
                        langURLPrefix +
                            "languages/" +
                            aPart +
                            "-ca-gregorian.json"
                    ),
                    $http.get(
                        langURLPrefix + "languages/" + aPart + "-numbers.json"
                    ),
                    $http.get(
                        langURLPrefix +
                            "languages/" +
                            aPart +
                            "-currencies.json"
                    ),

                    $http.get(langURLPrefix + "languages/likelySubtags.json"),
                    $http.get(langURLPrefix + "languages/timeData.json"),
                    $http.get(langURLPrefix + "languages/weekData.json"),
                    $http.get(langURLPrefix + "languages/currencyData.json"),
                    $http.get(
                        langURLPrefix + "languages/numberingSystems.json"
                    ),
                ])
                    .then(
                        function (ret) {
                            _.forEach(ret, function (x) {
                                Globalize.load(x.data);
                            });
                        } //loads data held in each array item to Globalize
                    )
                    .then(function () {
                        Globalize.locale(lang);
                        if (esCache) {
                            esCache.setItem("Globalize_" + lang, true);
                        }
                    })
                    .catch(function (xerr) {
                        throw xerr;
                    });
            } else {
                Globalize.locale(lang);
            }

            if (kendo) {
                kendo.culture(lang);
                if (!esCache.getItem("kendo_" + lang)) {
                    var kendoMessagesUrl =
                        langURLPrefix +
                        "languages/kendo.messages." +
                        lang +
                        ".min.js";

                    $.getScript(kendoMessagesUrl, function () {
                        esCache.setItem("kendo_" + lang, true);
                    });
                }
            }
        }
    }

    function getPivotColFormatType(col) {
        var colType = col.dataType;

        switch (colType) {
            case "decimal": {
                var fmt = col.format;
                var prec = 0;
                if (fmt) {
                    var idx = fmt.indexOf(".");
                    if (idx != -1) {
                        var s = fmt.slice(idx);
                        var cnt = s.split("0").length - 1;
                        prec = cnt < 0 ? 0 : cnt;
                    }
                }

                return {
                    type: "fixedPoint",
                    precision: prec,
                };
            }
            case "datetime":
                return "shortDateShortTime";
            case "date":
                return "shortDate";
            default:
                return null;
        }
    }

    function ESFavourites(inVal) {
        this.shortcuts = [];
        this.lastModified = new Date();

        if (!inVal) {
            return;
        }

        if (angular.isString(inVal)) {
            var source = JSON.parse(inVal);

            this.shortcuts = source.shortcuts || [];
            this.lastModified = source.lastModified;
            return;
        }

        if (angular.isArray(inVal)) {
            this.shortcuts = inVal;
        }
    }

    const FAVOURITES_TYPEID = 9000;
    const ESLINK_TYPEID = 9100;

    var loadFavourites = function (
        $q,
        esGlobals,
        esMessaging,
        esWebApiService,
        esCache
    ) {
        var deferred = $q.defer();
        var y = esCache.getItem("ES_USR_FAV");
        if (y) {
            deferred.resolve(y);
        } else {
            esWebApiService
                .getBodyFromES00Blob(
                    "ESGOUser",
                    esGlobals.getClientSession().connectionModel.GID,
                    9000
                )
                .then(function (ret) {
                    var x = new ESFavourites(ret.data.TextBody);
                    esCache.setItem("ES_USR_FAV", x);
                    deferred.resolve(x);
                })
                .catch(function (err) {
                    deferred.reject(err);
                });
        }

        return deferred.promise;
    };

    ESFavourites.prototype.addRemoveFav = function (
        esGlobals,
        esMessaging,
        esWebApiService,
        esPQDef,
        sTitle,
        bRemove
    ) {
        if (!esPQDef || !esPQDef.CtxID) {
            return;
        }

        var id = esPQDef.CtxID.toLowerCase();

        if (angular.isDefined(bRemove)) {
            _.pullAt(this.shortcuts, bRemove);
            esMessaging.publish("FAV_REMOVED", id);
        } else {
            var point = {
                ID: id,
                Params: esPQDef.Params.getSerialized(),
                Title: sTitle,
            };

            this.shortcuts.push(point);
        }

        return this.save(esGlobals, esWebApiService);
    };

    ESFavourites.prototype.clearAll = function (esGlobals, esWebApiService) {
        this.lastModified = new Date();

        this.shortcuts = [];
        return this.save(esGlobals, esWebApiService);
    };

    ESFavourites.prototype.save = function (esGlobals, esWebApiService) {
        this.lastModified = new Date();

        var blobInfo = {
            ObjectID: "ESGOUser",
            KeyID: esGlobals.getClientSession().connectionModel.GID,
            TypeID: FAVOURITES_TYPEID,
            TextBody: JSON.stringify(this),
        };
        return esWebApiService.postBodyToES00Blob(blobInfo);
    };

    ESFavourites.prototype.moveUpOrDown = function (
        esGlobals,
        esWebApiService,
        curPos,
        bUp
    ) {
        if (!this.shortcuts || this.shortcuts.length < 2) {
            return;
        }

        if (curPos == -1) {
            return;
        }

        if (curPos == 0 && bUp) {
            return;
        }

        if (curPos == this.shortcuts.length - 1 && !bUp) {
            return;
        }

        var newPos = bUp ? curPos - 1 : curPos + 1;
        var temp = this.shortcuts[newPos];
        this.shortcuts[newPos] = this.shortcuts[curPos];
        this.shortcuts[curPos] = temp;

        var promise = this.save(esGlobals, esWebApiService);
        return {
            from: curPos,
            to: newPos,
            promise: promise,
        };
    };

    function ESMasterDetailGridRelation(
        relationID,
        detailDataSource,
        detailParams,
        detailGridParamCode
    ) {
        this.relationID = relationID;
        this.detailDataSource = detailDataSource;
        this.detailParams = detailParams;
        this.detailParamCode = detailGridParamCode || "ISUDGID";
    }

    function ESRequeryDetailGrids() {
        this.registeredRelations = [];
    }

    ESRequeryDetailGrids.prototype.addDetailRelation = function (relInfo) {
        if (!relInfo || !(relInfo instanceof ESMasterDetailGridRelation)) {
            throw "relInfo parameter is null or is not of type ESMasterDetailGridRelation";
        }

        if (!relInfo.relationID) {
            throw "The parameter does not contain relationID or is null/emptystring/undefined";
        }

        var newRelId = relInfo.relationID.toLowerCase();
        var ix = _.findIndex(this.registeredRelations, function (x) {
            return x.relationID.toLowerCase() == newRelId;
        });
        if (ix < 0) {
            this.registeredRelations.push(relInfo);
        } else {
            this.registeredRelations[ix] = relInfo;
        }
        return this;
    };

    ESRequeryDetailGrids.prototype.getDetailRelation = function (relationId) {
        if (!relationID) {
            throw "relationID is null/emptystring/undefined";
        }

        var newRelId = relationID.toLowerCase();
        var ix = _.findIndex(this.registeredRelations, function (x) {
            return x.toLowerCase() == newRelId;
        });
        if (ix < 0) {
            return null;
        } else {
            return this.registeredRelations[ix];
        }
    };

    ESRequeryDetailGrids.prototype.removeDetailRelation = function (
        relationId
    ) {
        if (!relationID) {
            throw "relationID is null/emptystring/undefined";
        }

        var newRelId = relationID.toLowerCase();
        var ix = _.findIndex(this.registeredRelations, function (x) {
            return x.toLowerCase() == newRelId;
        });
        if (ix < 0) {
            return false;
        } else {
            this.registeredRelations = this.registeredRelations.splice(ix, 1);
            return true;
        }
    };

    function esAskForField($uibModal, inData) {
        if (!inData) {
            return;
        }

        var modalInstance = $uibModal.open({
            animation: true,
            ariaLabelledBy: "modal-title",
            ariaDescribedBy: "modal-body",
            template:
                "<div ng-include src=\"'src/partials/esAskForField.html'\"></div>",
            controller: "esAskForFieldCtrl",
            controllerAs: "$ctrl",
            size: "sm",
            appendTo: null,
            resolve: {
                inDef: function () {
                    return inData;
                },
            },
        });

        return modalInstance.result;
    }

    function esChangePassword($uibModal, inData) {
        if (!inData) {
            return;
        }

        var modalInstance = $uibModal.open({
            animation: true,
            ariaLabelledBy: "modal-title",
            ariaDescribedBy: "modal-body",
            template:
                "<div ng-include src=\"'src/partials/esChangePassword.html'\"></div>",
            controller: "esChangePasswordCtrl",
            controllerAs: "$ctrl",
            size: "md",
            appendTo: null,
            resolve: {
                inDef: function () {
                    return inData;
                },
            },
        });

        return modalInstance.result;
    }

    function esResolveBlobUrl(val, esWebApiService) {
        if (!val || !angular.isString(val)) return null;

        if (
            val.toLowerCase().trim().indexOf("http://") === 0 ||
            val.toLowerCase().trim().indexOf("https://") === 0
        ) {
            return val;
        } else {
            return esWebApiService.downloadES00BlobURLByGID(val, 0);
        }
    }

    function esResolveUserLogoUrl(val, esWebApiService) {
        if (!val || !angular.isString(val)) return null;

        if (
            val.toLowerCase().trim().indexOf("http://") === 0 ||
            val.toLowerCase().trim().indexOf("https://") === 0
        ) {
            return val;
        } else {
            return esWebApiService.userLogoUrl(val);
        }
    }

    /**
     * @ngdoc filter
     * @name es.Web.UI.filter:esTrustHtml
     *
     * @description
     * Creates `esGrid` Directive
     * * If `source` is not an object or array (inc. `null` and `undefined`), `source` is returned.
     * * If `source` is identical to 'destination' an exception will be thrown.
     *
     * @requires $sce
     */
    esWEBUI
        .filter("esTrustHtml", [
            "$sce",
            function ($sce) {
                return function (text) {
                    return $sce.trustAsHtml(text);
                };
            },
        ])
        .filter("esParamTypeMapper", [
            "esUIHelper",
            function (esUIHelper) {
                var f = function (pParam) {
                    if (
                        !pParam ||
                        !(pParam instanceof esUIHelper.ESParamInfo)
                    ) {
                        return "";
                    }
                    return pParam.paramTemplate();
                };
                return f;
            },
        ])

        .directive("errSrc", function () {
            return {
                link: function (scope, element, attrs) {
                    element.bind("error", function () {
                        if (attrs.src != attrs.errSrc) {
                            attrs.$set("src", attrs.errSrc);
                        }
                    });
                },
            };
        })

        .directive("esPositiveInteger", [
            "$parse",
            function ($parse) {
                var INTEGER_REGEXP = /^\+?\d+$/;
                return {
                    require: "ngModel",
                    restrict: "A",
                    link: function (scope, iElement, iAttrs, ctrl) {
                        var AllowZero = false;

                        if (angular.isDefined(iAttrs.esPositiveInteger)) {
                            try {
                                AllowZero = $parse(iAttrs.esPositiveInteger)(
                                    scope
                                );
                            } catch (ex) {}
                        }

                        ctrl.$validators.esPositiveInteger = function (
                            modelValue,
                            viewValue
                        ) {
                            if (
                                ctrl.$isEmpty(modelValue) || AllowZero
                                    ? modelValue < 0
                                    : modelValue <= 0
                            ) {
                                // consider empty models to be valid
                                return false;
                            }

                            if (INTEGER_REGEXP.test(viewValue)) {
                                // it is valid
                                return true;
                            }

                            // it is invalid
                            return false;
                        };
                    },
                };
            },
        ])

        .directive("esLogin", [
            "$q",
            "$http",
            "$translate",
            "$log",
            "$uibModal",
            "esWebApi",
            "esUIHelper",
            "esGlobals",
            "$sanitize",
            "$injector",
            function (
                $q,
                $http,
                $translate,
                $log,
                $uibModal,
                esWebApiService,
                esWebUIHelper,
                esGlobals,
                $sanitize,
                $injector
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esShowSubscription: "=",
                        esShowOnPremises: "=",
                        esShowBridge: "=",
                        esCredentials: "=",
                        esShowStickySession: "=",
                        esLoginLabel: "@?",
                        esLoginVersion: "@?",
                        esLoginUrl: "@?",
                        esLoginTerms: "@?",
                        esLoginTermsUrl: "@?",
                        esLoginSignUp: "@?",
                        esLoginSignUpUrl: "@?",
                        esLoginIcon: "=?",
                        esLoginShowRememberMe: "=?",
                        esOnSuccess: "&",
                    },
                    template:
                        "<div ng-include src=\"'src/partials/esLogin.html'\"></div>",
                    link: function ($scope, iElement, iAttrs) {
                        var onLangChanged = function () {
                            if ($scope.esCredentials.LangID) {
                                var lang = $scope.esCredentials.LangID;
                                doChangeLanguage(
                                    $translate,
                                    lang,
                                    $q,
                                    $http,
                                    $injector
                                );
                            }
                            window.esLoginLanguage =
                                $scope.esCredentials.LangID ||
                                navigator.language ||
                                navigator.userLanguage ||
                                "en-US";
                        };

                        $scope.esGlobals = esGlobals;
                        $scope.esLangOptions = {
                            dataSource: esGlobals.esSupportedLanguages,
                            dataTextField: "title",
                            dataValueField: "id",
                            change: onLangChanged,
                            valuePrimitive: true,
                            autoBind: true,
                            valueTemplate:
                                "<img ng-src={{dataItem.icon}}></img><span>{{dataItem.title}}</span>",
                            template:
                                "<img ng-src={{dataItem.icon}}></img><span>{{dataItem.title}}</span>",
                        };

                        if ($scope.esCredentials.LangID) {
                            var lang = $scope.esCredentials.LangID;
                            doChangeLanguage(
                                $translate,
                                lang,
                                $q,
                                $http,
                                $injector
                            );
                        }
                    },
                };
            },
        ])

        .directive("esPropertyQuestion", [
            "$log",
            "$uibModal",
            "esWebApi",
            "esUIHelper",
            "esGlobals",
            "$sanitize",
            function (
                $log,
                $uibModal,
                esWebApiService,
                esWebUIHelper,
                esGlobals,
                $sanitize
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esQuestion: "=",
                        esPsDef: "=",
                        esPsVal: "=",
                    },
                    template:
                        "<div ng-include src=\"'src/partials/esSurvey/esPropertyQuestion_'+esQuestion.PType+'.html'\"></div>",
                    link: function ($scope, iElement, iAttrs) {
                        $scope.esGlobals = esGlobals;

                        //Check for ZoomDS
                        var qs = $scope.esQuestion;
                        if (qs && qs.PArg && qs.PType == 7) {
                            $scope[qs.PArg + "_DS"] =
                                esWebUIHelper.getZoomDataSource(qs.PArg);
                        }

                        $scope.openCalendar = function ($event) {
                            $scope.calendarStatus.opened = true;
                        };

                        $scope.calendarStatus = {
                            opened: false,
                        };

                        $scope.calendarFormat = "dd-MMMM-yyyy";

                        $scope.getScale = function (upTo) {
                            if (!upTo || isNaN(upTo)) {
                                return [];
                            }

                            return _.range(1, Math.abs(parseInt(upTo)) + 1);
                        };

                        $scope.getChoicesOfQuestion = function () {
                            if (
                                !$scope.esQuestion ||
                                !$scope.esQuestion.PArg ||
                                !$scope.esPsDef ||
                                !$scope.esPsDef.Choices
                            ) {
                                return [];
                            }

                            return _.sortBy(
                                _.filter($scope.esPsDef.Choices, {
                                    ChoiceCode: $scope.esQuestion.PArg,
                                }),
                                "OrderPriority"
                            );
                        };
                    },
                };
            },
        ]);

    function convertPQRowsToMapRows(rows, valueField) {
        if (!rows) {
            return rows;
        }

        if (angular.isArray(rows) && rows.length == 0) {
            return rows;
        }

        var ts = _.forEach(rows, function (r) {
            r.latlng = [r.Latitude, r.Longitude];
        });

        return _.filter(ts, function (x) {
            if (!(x.Longitude && x.Latitude)) {
                return false;
            }

            if (!valueField) {
                return true;
            }

            return x[valueField] > 0;
        });
    }

    esWEBUI
        .filter("esPQDSToesMapDS", function () {
            return convertPQRowsToMapRows;
        })

        .directive("esSurvey", [
            "$log",
            "$uibModal",
            "esWebApi",
            "esUIHelper",
            "esGlobals",
            "$sanitize",
            function (
                $log,
                $uibModal,
                esWebApiService,
                esWebUIHelper,
                esGlobals,
                $sanitize
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esSectionIdx: "=",
                        esPsDef: "=",
                        esPsVal: "=",
                    },
                    template:
                        "<div ng-include src=\"'src/partials/esSurvey/esSurvey.html'\"></div>",
                    link: function ($scope, iElement, iAttrs) {
                        $scope.esGlobals = esGlobals;

                        $scope.isIntroduction = function () {
                            return $scope.esSectionIdx < 0;
                        };

                        $scope.isLast = function () {
                            if (!$scope.esPsDef || !$scope.esPsDef.Sections) {
                                return true;
                            }
                            return (
                                $scope.esSectionIdx ==
                                $scope.esPsDef.Sections.length - 1
                            );
                        };

                        $scope.saveAndComplete = function () {};

                        $scope.getQuestionsofSection = function () {
                            if (
                                !$scope.esPsDef ||
                                !$scope.esPsDef.Sections ||
                                $scope.esSectionIdx < 0 ||
                                $scope.esSectionId >=
                                    $scope.esPsDef.Sections.length
                            ) {
                                return [];
                            }

                            var sect =
                                $scope.esPsDef.Sections[$scope.esSectionIdx]
                                    .Code;
                            if (!sect) {
                                return [];
                            }

                            return _.sortBy(
                                _.filter($scope.esPsDef.Lines, {
                                    Category_Code: sect,
                                }),
                                "SeqNum"
                            );
                        };

                        $scope.progress = function () {
                            if (
                                $scope.esSectionIdx < 0 ||
                                !$scope.esPsDef ||
                                !$scope.esPsDef.Sections ||
                                !$scope.esPsDef.Sections.length
                            ) {
                                return 0;
                            }

                            return Math.round(
                                (($scope.esSectionIdx + 1) /
                                    $scope.esPsDef.Sections.length) *
                                    100
                            );
                        };

                        $scope.advanceStep = function () {
                            if ($scope.isLast()) {
                                return;
                            }
                            $scope.esSectionIdx += 1;
                        };

                        $scope.backStep = function () {
                            if ($scope.isIntroduction()) {
                                return;
                            }
                            $scope.esSectionIdx -= 1;
                        };
                    },
                };
            },
        ])

        .directive("esChecklistModel", [
            "$parse",
            "$compile",
            function ($parse, $compile) {
                // contains
                function contains(arr, item, comparator) {
                    if (angular.isArray(arr)) {
                        for (var i = arr.length; i--; ) {
                            if (comparator(arr[i], item)) {
                                return true;
                            }
                        }
                    }
                    return false;
                }

                // add
                function add(arr, item, comparator) {
                    arr = angular.isArray(arr) ? arr : [];
                    if (!contains(arr, item, comparator)) {
                        arr.push(item);
                    }
                    return arr;
                }

                // remove
                function remove(arr, item, comparator) {
                    if (angular.isArray(arr)) {
                        for (var i = arr.length; i--; ) {
                            if (comparator(arr[i], item)) {
                                arr.splice(i, 1);
                                break;
                            }
                        }
                    }
                    return arr;
                }

                // http://stackoverflow.com/a/19228302/1458162
                function postLinkFn(scope, elem, attrs) {
                    // exclude recursion, but still keep the model
                    var esChecklistModel = attrs.esChecklistModel;
                    attrs.$set("esChecklistModel", null);
                    // compile with `ng-model` pointing to `checked`
                    $compile(elem)(scope);
                    attrs.$set("esChecklistModel", esChecklistModel);

                    // getter for original model
                    var esChecklistModelGetter = $parse(esChecklistModel);
                    var checklistChange = $parse(attrs.checklistChange);
                    var checklistBeforeChange = $parse(
                        attrs.checklistBeforeChange
                    );
                    var ngModelGetter = $parse(attrs.ngModel);

                    /*
                                                                                                                ctrl.$validators.esCount = function(modelValue, viewValue) {
                                                                                                                                                return true;
                                                                                                                };
                */
                    var comparator = angular.equals;

                    if (attrs.hasOwnProperty("checklistComparator")) {
                        if (attrs.checklistComparator[0] == ".") {
                            var comparatorExpression =
                                attrs.checklistComparator.substring(1);
                            comparator = function (a, b) {
                                return (
                                    a[comparatorExpression] ===
                                    b[comparatorExpression]
                                );
                            };
                        } else {
                            comparator = $parse(attrs.checklistComparator)(
                                scope.$parent
                            );
                        }
                    }

                    // watch UI checked change
                    scope.$watch(attrs.ngModel, function (newValue, oldValue) {
                        if (newValue === oldValue) {
                            return;
                        }

                        if (
                            checklistBeforeChange &&
                            checklistBeforeChange(scope) === false
                        ) {
                            ngModelGetter.assign(
                                scope,
                                contains(
                                    esChecklistModelGetter(scope.$parent),
                                    getChecklistValue(),
                                    comparator
                                )
                            );
                            return;
                        }

                        setValueInesChecklistModel(
                            getChecklistValue(),
                            newValue
                        );

                        if (checklistChange) {
                            checklistChange(scope);
                        }
                    });

                    // watches for value change of esChecklistValue (Credit to @blingerson)
                    scope.$watch(
                        getChecklistValue,
                        function (newValue, oldValue) {
                            if (
                                newValue != oldValue &&
                                angular.isDefined(oldValue) &&
                                scope[attrs.ngModel] === true
                            ) {
                                var current = esChecklistModelGetter(
                                    scope.$parent
                                );
                                esChecklistModelGetter.assign(
                                    scope.$parent,
                                    remove(current, oldValue, comparator)
                                );
                                esChecklistModelGetter.assign(
                                    scope.$parent,
                                    add(current, newValue, comparator)
                                );
                            }
                        }
                    );

                    function getChecklistValue() {
                        return attrs.esChecklistValue
                            ? $parse(attrs.esChecklistValue)(scope.$parent)
                            : attrs.value;
                    }

                    function setValueInesChecklistModel(value, checked) {
                        var current = esChecklistModelGetter(scope.$parent);
                        if (angular.isFunction(esChecklistModelGetter.assign)) {
                            if (checked === true) {
                                esChecklistModelGetter.assign(
                                    scope.$parent,
                                    add(current, value, comparator)
                                );
                            } else {
                                esChecklistModelGetter.assign(
                                    scope.$parent,
                                    remove(current, value, comparator)
                                );
                            }
                        }
                    }

                    // declare one function to be used for both $watch functions
                    function setChecked(newArr, oldArr) {
                        if (
                            checklistBeforeChange &&
                            checklistBeforeChange(scope) === false
                        ) {
                            setValueInesChecklistModel(
                                getChecklistValue(),
                                ngModelGetter(scope)
                            );
                            return;
                        }
                        ngModelGetter.assign(
                            scope,
                            contains(newArr, getChecklistValue(), comparator)
                        );
                    }

                    // watch original model change
                    // use the faster $watchCollection method if it's available
                    if (angular.isFunction(scope.$parent.$watchCollection)) {
                        scope.$parent.$watchCollection(
                            esChecklistModel,
                            setChecked
                        );
                    } else {
                        scope.$parent.$watch(
                            esChecklistModel,
                            setChecked,
                            true
                        );
                    }
                }

                return {
                    restrict: "A",
                    priority: 1000,
                    terminal: true,
                    scope: true,
                    compile: function (tElement, tAttrs) {
                        if (!tAttrs.esChecklistValue && !tAttrs.value) {
                            throw "You should provide `value` or `checklist-value`.";
                        }

                        // by default ngModel is 'checked', so we set it if not specified
                        if (!tAttrs.ngModel) {
                            // local scope var storing individual checkbox model
                            tAttrs.$set("ngModel", "checked");
                        }

                        return postLinkFn;
                    },
                };
            },
        ])

        .controller("esComboPQCtrl", [
            "$scope",
            "$log",
            "$window",
            "esMessaging",
            "esWebApi",
            "esUIHelper",
            "esGlobals",
            "$translate",
            "$uibModal",
            "$q",
            "esCache",
            "$timeout",
            "$interval",
            "clipboard",
            function (
                $scope,
                $log,
                $window,
                esMessaging,
                esWebApiService,
                esWebUIHelper,
                esGlobals,
                $translate,
                $uibModal,
                $q,
                esCache,
                $timeout,
                $interval,
                clipboard
            ) {
                function esTranslate(item, lang) {
                    if (lang) {
                        lang = lang.split("-")[0];
                    }

                    function fallBack(item) {
                        var trans = item["en"];
                        if (trans) {
                            return trans;
                        }
                        for (var prop in item) {
                            return item[prop];
                        }
                        return "";
                    }

                    if (!item) {
                        return "";
                    }

                    if (angular.isString(item)) {
                        return item;
                    }

                    if (!angular.isObject(item)) {
                        return item;
                    }

                    if (!lang) {
                        return fallBack(item);
                    }

                    return item[lang] || fallBack(item);
                }

                function processesDef(esDef, lang) {
                    if (angular.isArray(esDef)) {
                        _.forEach(esDef, function (x) {
                            processesDef(x, lang);
                        });

                        return;
                    }

                    if (esDef && esDef.Title) {
                        esDef.Title = esTranslate(esDef.Title, lang);
                    }

                    if (angular.isArray(esDef)) {
                        processesDef(esDef, lang);
                        return;
                    }

                    if (esDef && esDef.Description) {
                        esDef.Description = esTranslate(
                            esDef.Description,
                            lang
                        );
                    }

                    if (esDef && esDef.UIOptions && esDef.UIOptions.title) {
                        esDef.UIOptions.title = esTranslate(
                            esDef.UIOptions.title,
                            lang
                        );
                    }

                    if (esDef && esDef.UIOptions && esDef.UIOptions.valueAxis) {
                        var loop = angular.isArray(esDef.UIOptions.valueAxis)
                            ? esDef.UIOptions.valueAxis
                            : [esDef.UIOptions.valueAxis];
                        _.forEach(loop, function (x) {
                            if (x.title && x.title.text) {
                                x.title.text = esTranslate(x.title.text, lang);
                            }
                        });
                    }

                    if (esDef && esDef.UIOptions && esDef.UIOptions.xAxis) {
                        var loop = angular.isArray(esDef.UIOptions.xAxis)
                            ? esDef.UIOptions.xAxis
                            : [esDef.UIOptions.xAxis];
                        _.forEach(loop, function (x) {
                            if (x.title && x.title.text) {
                                x.title.text = esTranslate(x.title.text, lang);
                            }
                        });
                    }

                    if (esDef && esDef.UIOptions && esDef.UIOptions.yAxis) {
                        var loop = angular.isArray(esDef.UIOptions.yAxis)
                            ? esDef.UIOptions.yAxis
                            : [esDef.UIOptions.yAxis];
                        _.forEach(loop, function (x) {
                            if (x.title && x.title.text) {
                                x.title.text = esTranslate(x.title.text, lang);
                            }
                        });
                    }

                    if (esDef && esDef.UIOptions && esDef.UIOptions.valueAxes) {
                        var loop = angular.isArray(esDef.UIOptions.valueAxes)
                            ? esDef.UIOptions.valueAxes
                            : [esDef.UIOptions.valueAxes];
                        _.forEach(loop, function (x) {
                            if (x.title && x.title.text) {
                                x.title.text = esTranslate(x.title.text, lang);
                            }
                        });
                    }

                    if (esDef && esDef.UIOptions && esDef.UIOptions.series) {
                        var loop = angular.isArray(esDef.UIOptions.series)
                            ? esDef.UIOptions.series
                            : [esDef.UIOptions.series];
                        _.forEach(loop, function (x) {
                            if (x.title) {
                                x.title = esTranslate(x.title, lang);
                            }
                        });
                    }
                }

                function processComponent(item, lang) {
                    if (angular.isArray(item)) {
                        _.forEach(item, function (x) {
                            processComponent(x, lang);
                        });
                        return;
                    }

                    if (angular.isObject(item)) {
                        if (angular.isDefined(item.Title)) {
                            item.Title = esTranslate(item.Title, lang);
                        }

                        if (angular.isDefined(item.Description)) {
                            item.Description = esTranslate(
                                item.Description,
                                lang
                            );
                        }

                        processesDef(item, lang);

                        if (item.esDef) {
                            processesDef(item.esDef, lang);
                        }
                    }
                }

                function processItem(item, lang) {
                    if (!lang) {
                        lang = esGlobals.getLocale();
                    }
                    if (angular.isArray(item)) {
                        item = _.map(item, function (x) {
                            return _.orderBy(x, ["AA"]);
                        });
                    }
                    processComponent(item, lang);
                    return item;
                }

                function transformIn(arr) {
                    var arr_defs = _.map(arr, function (x) {
                        if (angular.isArray(x)) {
                            return transformIn(x);
                        }

                        var pqDef =
                            new esGlobals.ESPublicQueryDef().initFromObj(
                                x.esDef
                            );
                        pqDef.ESUIType = x.ESUIType.toLowerCase();
                        pqDef.CtxID = x.ID;
                        if (x.esDef) {
                            pqDef.Params = esWebUIHelper.createESParams(
                                x.esDef.Params
                            );
                        }
                        pqDef.AA = x.AA;
                        pqDef.Title = x.Title;
                        return pqDef;
                    });
                    return arr_defs;
                }

                var runOnSuccess = function () {
                    $scope.globalExecutePQ = function (a, b) {
                        var globalParamsDefs =
                            $scope.esPqDef.GlobalParamsPanel.Parameters;

                        $scope.esPqDef.GlobalParamsPanel.esPanelOpen.status = false;

                        _.forEach($scope.esPqDef, function (section) {
                            _.forEach(section, function (dbItem) {
                                _.forEach(
                                    globalParamsDefs.paramsValues,
                                    function (globalParam) {
                                        var x =
                                            dbItem.Params[
                                                globalParam.paramCode
                                            ];
                                        if (x) {
                                            x.pValue(globalParam.pValue());
                                        }
                                    }
                                );

                                dbItem.runPQ && dbItem.runPQ();
                            });
                        });
                    };

                    $scope.showUserMessage = function (message) {
                        if (
                            $scope.esShowUserMessage &&
                            angular.isFunction($scope.esShowUserMessage)
                        ) {
                            $scope.esShowUserMessage({ message: message });
                        }
                    };

                    if ($scope.esPqDef.ID == "favourites") {
                        getFavourites();
                    }

                    var arr = [];
                    if ($scope.esPqDef.ESUIType.toLowerCase() != "escombo") {
                        arr = [$scope.esPqDef];
                    } else {
                        //combo case
                        arr = $scope.esPqDef.esDef;
                        arr = _.map(arr, function (x) {
                            if (angular.isArray(x)) {
                                return x;
                            } else {
                                return [x];
                            }
                        });
                    }

                    var arr_defs = transformIn(arr);

                    var fin;
                    if ($scope.esPqDef.ESUIType.toLowerCase() != "escombo") {
                        fin = processItem(arr_defs[0]);
                    } else {
                        // case combo
                        fin = processItem(arr_defs);
                    }

                    if ($scope.esPqDef.GlobalParamsPanel) {
                        var copyDefs = [];
                        if ($scope.esPqDef.GlobalParamsPanel.Parameters) {
                            var lang = esGlobals.getLocale();

                            _.forEach(
                                $scope.esPqDef.GlobalParamsPanel.Parameters,
                                function (z) {
                                    var d = angular.merge({}, z);
                                    if (d.caption) {
                                        d.caption = esTranslate(
                                            d.caption,
                                            lang
                                        );
                                    }
                                    if (d.tooltip) {
                                        d.tooltip = esTranslate(
                                            d.tooltip,
                                            lang
                                        );
                                    }

                                    copyDefs.push(d);
                                }
                            );
                        }
                        var promises = [];
                        var paramsdef = new esWebUIHelper.ESParamsDefinitions(
                            "",
                            []
                        );
                        paramsdef = paramsdef.createDefinitions("", copyDefs);

                        _.forEach(fin, function (i) {
                            _.forEach(i, function (dbItem) {
                                if (
                                    dbItem.UIOptions &&
                                    dbItem.UIOptions.autoBind
                                ) {
                                    dbItem.UIOptions.autoBind = false;
                                }

                                if (
                                    dbItem.PQOptions &&
                                    dbItem.PQOptions.AutoExecute
                                ) {
                                    dbItem.PQOptions.AutoExecute = false;
                                }

                                dbItem.isDonePromise = $q.defer();
                                var pp = dbItem.isDonePromise.promise;

                                promises.push(pp);
                            });
                        });

                        fin.GlobalParamsPanel = {
                            AutoExecute:
                                $scope.esPqDef.GlobalParamsPanel.AutoExecute,
                            esPanelOpen: {
                                status:
                                    $scope.esPqDef.GlobalParamsPanel
                                        .esPanelOpen &&
                                    $scope.esPqDef.GlobalParamsPanel.esPanelOpen
                                        .status,
                            },
                            Parameters: paramsdef,
                        };
                        if (
                            $scope.esPqDef.GlobalParamsPanel.ReExecute < 1 ||
                            $scope.esPqDef.GlobalParamsPanel.ReExecute >= 60
                        ) {
                            fin.GlobalParamsPanel.ReExecute = 0;
                            console.log(
                                "GlobalParamsPanel.ReExecute value should be between 1 min and 59 mins - " +
                                    $scope.esPqDef.ID
                            );
                        } else {
                            fin.GlobalParamsPanel.ReExecute =
                                $scope.esPqDef.GlobalParamsPanel.ReExecute;
                        }

                        fin.Title = $scope.esPqDef.Title;
                        fin.Description = $scope.esPqDef.Description;

                        $q.all(promises)
                            .then(function (ret) {
                                var globalParamsDefs =
                                    $scope.esPqDef.GlobalParamsPanel.Parameters;

                                if ($scope.esUrlParams) {
                                    _.forEach(
                                        Object.keys($scope.esUrlParams),
                                        function (u) {
                                            var gp =
                                                globalParamsDefs.paramsValues[
                                                    u
                                                ];
                                            if (gp) {
                                                gp.pValue(
                                                    $scope.esUrlParams[u]
                                                );
                                            }
                                        }
                                    );
                                }

                                _.forEach(ret, function (dbItem) {
                                    _.forEach(
                                        globalParamsDefs.paramsValues,
                                        function (globalParam) {
                                            var x =
                                                dbItem.Params[
                                                    globalParam.paramCode
                                                ];
                                            if (x) {
                                                x.pValue(globalParam.pValue());
                                            }
                                        }
                                    );

                                    var pDef =
                                        dbItem.ParametersDefinition &&
                                        dbItem.ParametersDefinition();
                                    if (
                                        pDef instanceof
                                        esWebUIHelper.ESParamsDefinitions
                                    ) {
                                        _.forEach(
                                            pDef.definitions,
                                            function (p) {
                                                var xyz = _.find(
                                                    $scope.esPqDef
                                                        .GlobalParamsPanel
                                                        .Parameters.definitions,
                                                    { id: p.id }
                                                );
                                                if (xyz) {
                                                    p.visible = false;
                                                }
                                            }
                                        );
                                    }
                                });

                                var tm;
                                var tStep;
                                var tInterval = 20;
                                var dRun;
                                var lastRunOn = "";

                                var model = esGlobals
                                    .getClientSession()
                                    .getModel();
                                if (
                                    !model ||
                                    !model.Claims ||
                                    !model.Claims.ESApplicationID ||
                                    model.Claims.ESApplicationID !=
                                        "espremanalyzer"
                                ) {
                                    $scope.esPqDef.GlobalParamsPanel.ReExecute = 0;
                                }

                                if (
                                    $scope.esPqDef.GlobalParamsPanel.ReExecute
                                ) {
                                    tStep =
                                        $scope.esPqDef.GlobalParamsPanel
                                            .ReExecute *
                                        (60 / tInterval);
                                    $scope.globalTitle =
                                        "Last Run - // NEXT Run in " +
                                        moment
                                            .duration(
                                                tStep * tInterval,
                                                "seconds"
                                            )
                                            .humanize();

                                    tm = $interval(function () {
                                        tStep--;
                                        if (tStep == 0) {
                                            $scope.globalExecutePQ();
                                            dRun = moment();
                                            tStep =
                                                $scope.esPqDef.GlobalParamsPanel
                                                    .ReExecute *
                                                (60 / tInterval);
                                        }

                                        $scope.globalTitle =
                                            "Last Run " +
                                            (dRun ? dRun.fromNow() : " -") +
                                            " // Next Run in " +
                                            moment
                                                .duration(
                                                    tStep * tInterval,
                                                    "seconds"
                                                )
                                                .humanize();
                                    }, tInterval * 1000);

                                    $scope.$on("$destroy", function () {
                                        if (tm) {
                                            $interval.cancel(tm);
                                            tm = null;
                                        }
                                    });
                                }

                                if (
                                    $scope.esPqDef.GlobalParamsPanel.AutoExecute
                                ) {
                                    $scope.globalExecutePQ();
                                    if (
                                        $scope.esPqDef.GlobalParamsPanel
                                            .ReExecute
                                    ) {
                                        dRun = moment();
                                        $scope.globalTitle =
                                            "Last Run " +
                                            dRun.fromNow() +
                                            " // Next Run in " +
                                            moment
                                                .duration(
                                                    tStep * tInterval,
                                                    "seconds"
                                                )
                                                .humanize();
                                    }
                                }
                            })
                            .catch(function (err) {
                                console.log(err);
                            });
                    }
                    $scope.esPqDef = fin;
                };

                function errReport(ex) {
                    var s = esGlobals.getUserMessage(ex);
                    if (!s.isLogin) {
                        $scope.showUserMessage(s.messageToShow);
                    }
                }

                function findFavItem(dbItem) {
                    return _.findIndex($scope.esPqDef, function (y) {
                        return y[0] == dbItem;
                    });
                }

                $scope.Favourites = null;
                $scope.globalTitle = $translate.instant(
                    "ESUI.PARAMS_PANEL.TITLE"
                );

                var getFavourites = function () {
                    var deferred = $q.defer();

                    if (!$scope.Favourites) {
                        loadFavourites(
                            $q,
                            esGlobals,
                            esMessaging,
                            esWebApiService,
                            esCache
                        )
                            .then(function (ret) {
                                $scope.Favourites = ret;
                                deferred.resolve($scope.Favourites);
                            })
                            .catch(function (err) {
                                deferred.reject(err);
                            });
                    } else {
                        deferred.resolve($scope.Favourites);
                    }
                    return deferred.promise;
                };

                $scope.email = function (pqid) {
                    var blobInfo = {
                        ObjectID: "esanalyzer",
                        KeyID: "eslink",
                        IsNew: true,
                        TypeID: ESLINK_TYPEID,
                        TextBody: JSON.stringify({
                            ID: pqid.CtxID,
                            Params: pqid.Params.getSerialized(),
                            Title: pqid.Title,
                        }),
                    };

                    esWebApiService
                        .postBodyToES00Blob(blobInfo)
                        .then(function (ret) {
                            if (clipboard && clipboard.supported) {
                                var linkurl = ret.data;
                                if (
                                    $scope.esLinkPrefix &&
                                    $scope.esLinkPrefix.replace(
                                        "{0}",
                                        ret.data
                                    ) != $scope.esLinkPrefix
                                ) {
                                    linkurl = $scope.esLinkPrefix.replace(
                                        "{0}",
                                        ret.data
                                    );
                                }

                                var x = {
                                    id: "shortcut",
                                    title: $translate.instant("ESUI.FAV.LINK"),
                                    required: true,
                                    inputType: "readonly",
                                    caption: $translate.instant(
                                        "ESUI.FAV.PROMPT_LINK"
                                    ),
                                    param: new esGlobals.ESParamVal(
                                        "fav_link",
                                        linkurl
                                    ),
                                };

                                esWebUIHelper
                                    .esAskForField($uibModal, x)
                                    .then(function () {
                                        if (clipboard && clipboard.supported) {
                                            clipboard.copyText(linkurl);
                                            $scope.showUserMessage(
                                                $translate.instant(
                                                    "ESUI.FAV.COPY_CLIPBOARD_OK"
                                                )
                                            );
                                        }
                                    })
                                    .catch(function (err) {
                                        esWebApiService
                                            .removeEntityBlob({
                                                GID: ret.data,
                                            })
                                            .catch(function () {});
                                    });
                            }
                        })
                        .catch(function (err) {
                            errReport(err);
                        });
                };

                $scope.addRemoveFav = function (pqid, bAdd) {
                    var title = "";

                    if (bAdd) {
                        var x = {
                            id: "shortcut",
                            title: $translate.instant("ESUI.FAV.ADD"),
                            required: true,
                            caption: $translate.instant(
                                "ESUI.FAV.PROMPT_TITLE"
                            ),
                            param: new esGlobals.ESParamVal("fav_title", ""),
                        };

                        esWebUIHelper
                            .esAskForField($uibModal, x)
                            .then(function () {
                                getFavourites()
                                    .then(function (fav) {
                                        var promise = fav.addRemoveFav(
                                            esGlobals,
                                            esMessaging,
                                            esWebApiService,
                                            pqid,
                                            x.param.pValue()
                                        );
                                        if (!promise) {
                                            return;
                                        }
                                        promise
                                            .then(function (ret) {
                                                $scope.showUserMessage(
                                                    $translate.instant(
                                                        "ESUI.FAV.SAVE_SUCCESS"
                                                    )
                                                );
                                            })
                                            .catch(function (ex) {
                                                errReport(ex);
                                            });
                                    })
                                    .catch(function (err) {
                                        errReport(err);
                                        return;
                                    });
                            })
                            .catch(function (ex) {
                                if (ex != "cancel") {
                                    errReport(ex);
                                }
                            });
                    } else {
                        // remove
                        var removeIndex = findFavItem(pqid);

                        if (removeIndex == -1) {
                            return;
                        }

                        getFavourites()
                            .then(function (fav) {
                                var promise = fav.addRemoveFav(
                                    esGlobals,
                                    esMessaging,
                                    esWebApiService,
                                    pqid,
                                    "",
                                    removeIndex
                                );
                                if (!promise) {
                                    return;
                                }

                                promise
                                    .then(function (ret) {
                                        $scope.esPqDef.splice(removeIndex, 1);
                                        $scope.showUserMessage(
                                            $translate.instant(
                                                "ESUI.FAV.SAVE_SUCCESS"
                                            )
                                        );
                                    })
                                    .catch(function (ex) {
                                        errReport(ex);
                                    });
                            })
                            .catch(function (err) {
                                errReport(err);
                            });
                    }
                };

                $scope.clearAll = function () {
                    if (
                        !confirm($translate.instant("ESUI.FAV.CONFIRM_CLEAR"))
                    ) {
                        return;
                    }

                    getFavourites()
                        .then(function (fav) {
                            var promise = fav
                                .clearAll(esGlobals, esWebApiService)
                                .then(function (ret) {
                                    $scope.esPqDef = [];
                                    $scope.showUserMessage(
                                        $translate.instant(
                                            "ESUI.FAV.SAVE_SUCCESS"
                                        )
                                    );
                                })
                                .catch(function (ex) {
                                    errReport(ex);
                                });
                        })
                        .catch(function (err) {
                            errReport(err);
                        });
                };

                $scope.moveUpOrDown = function (dbItem, bUp) {
                    var itemPos = findFavItem(dbItem);

                    if (itemPos == -1 || !$scope.canMoveUpOrDown(dbItem, bUp)) {
                        return;
                    }

                    getFavourites($q, esGlobals, esMessaging, esWebApiService)
                        .then(function (fav) {
                            var ret = fav.moveUpOrDown(
                                esGlobals,
                                esWebApiService,
                                itemPos,
                                bUp
                            );
                            if (!ret) {
                                return;
                            }

                            ret.promise
                                .then(function () {
                                    var temp = $scope.esPqDef[ret.to];
                                    $scope.esPqDef[ret.to] =
                                        $scope.esPqDef[ret.from];
                                    $scope.esPqDef[ret.from] = temp;
                                    $scope.showUserMessage(
                                        $translate.instant(
                                            "ESUI.FAV.SAVE_SUCCESS"
                                        )
                                    );
                                })
                                .catch(function (ex) {
                                    errReport(ex);
                                });
                        })
                        .catch(function (err) {
                            errReport(err);
                        });
                };

                $scope.canMoveUpOrDown = function (dbItem, bUp) {
                    var xIndex = findFavItem(dbItem);

                    if (xIndex == -1) {
                        return false;
                    }

                    if (bUp) {
                        return xIndex != 0;
                    }

                    // Down
                    return xIndex < $scope.esPqDef.length - 1;
                };

                runOnSuccess();
            },
        ])

        .directive("esComboPq", [
            "$log",
            "esWebApi",
            "esMessaging",
            "esUIHelper",
            "esGlobals",
            function (
                $log,
                esWebApiService,
                esMessaging,
                esWebUIHelper,
                esGlobals
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esPqDef: "=",
                        esInApp: "=?",
                        esUrlParams: "=?",
                        isFavouritesMode: "=?",
                        esLinkPrefix: "=?",
                        esSimpleMode: "=?",
                        esShowUserMessage: "&",
                    },
                    templateUrl: function (element, attrs) {
                        return "src/partials/esComboPQ.html";
                    },
                };
            },
        ])

        /**
         * @ngdoc directive
         * @name es.Web.UI.directive:esGrid
         * @requires es.Services.Web.esWebApi Entersoft AngularJS WEB API for Entersoft Application Server
         * @requires es.Web.UI.esUIHelper
         * @requires $log
         * @restrict AE
         * @param {template} esGroupId The Entersoft Public Query Group ID
         * @param {template} esFilterId The Entersoft Public Query Filter ID
         * @param {esGridInfoOptions=} esGridOptions should grid options are already available you can explicitly assign
         * @param {object=} esExecuteParams Params object that will be used when executing the public query
         *
         * @description
         *
         * **TBD**
         * This directive is responsible to render the html for the presentation of the results / data of an Entersoft Public Query.
         * The esGrid generates a Telerik kendo-grid web ui element {@link http://docs.telerik.com/KENDO-UI/api/javascript/ui/grid kendo-grid}.
         *
         * In order to instantiate an esGrid with an Angular application, you have to provide the parameters esGroupId and esFilterId are required.
         * These two parameters along with esExecuteParams will be supplied to the {@link es.Web.UI.esUIHelper#methods_esGridInfoToKInfo esToKendoTransform function}
         */
        .directive("esGrid", [
            "$log",
            "esWebApi",
            "esMessaging",
            "esUIHelper",
            "esGlobals",
            function (
                $log,
                esWebApiService,
                esMessaging,
                esWebUIHelper,
                esGlobals
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esGroupId: "=",
                        esFilterId: "=",
                        esExecuteParams: "=",
                        esGridOptions: "=?",
                        esPostGridOptions: "=?",
                        esPQOptions: "=?",
                        esDataSource: "=?"                                                            
                    },
                    templateUrl: function (element, attrs) {
                        return "src/partials/esGrid.html";
                    },
                    link: function ($scope, iElement, iAttrs) {                        
                        // Define checkedItems array in the scope
                        $scope.checkedItems = [];    
                        
                        // Define if the showGetCheckedItemsButton is visible 
                        $scope.showGetCheckedItemsButton = false;

                        $scope.esGridRun = function () {
                            $scope.checkedItems = [];

                            if ($scope.$parent && $scope.$parent.esPanelOpen) {
                                $scope.$parent.esPanelOpen.status = false;
                            }

                            if (
                                $scope.esGridOptions &&
                                $scope.esGridOptions.dataSource
                            ) {
                                if (
                                    $scope.esPQOptions &&
                                    !$scope.esPQOptions.ServerPaging
                                ) {
                                    // Refresh all the data from server (no server paging)
                                    // and then go to page 1
                                    $scope.esGridOptions.dataSource.read();
                                    $scope.esGridOptions.dataSource.page(1);
                                } else {
                                    $scope.esGridOptions.dataSource.page(1);
                                }
                            }
                        }; 

                        // Function to get checked items
                        $scope.getCheckedItems = function() {
                           // console.log("Checked items:", $scope.checkedItems);

                            if ($scope.checkedItems.length > 0) {
                                // Construct the download URL with multiple id parameters
                                var downloadUrl = "/api/collaboration/exportfile?id=";

                                for (var i = 0; i < $scope.checkedItems.length; i++) {
                                    downloadUrl += $scope.checkedItems[i];
                                    if (i < $scope.checkedItems.length - 1) {
                                        downloadUrl += ",";
                                    }
                                }

                                //console.log(downloadUrl);
                       
                                var link = document.createElement('a');
                                link.download = 'download';
                                link.href = downloadUrl;
                                link.style.display = 'none';
                                document.body.appendChild(link);
                       
                                link.click();
                       
                                document.body.removeChild(link);
                            }else{
                                console.log("No checked items");
                            }
                        };   

                        $scope.updateCheckedItems = function (dataItem) {
                           // console.log('updateCheckedItems');
                           // console.log(dataItem);
                            var itemId = dataItem.ISUDGID; // Assuming 'ISUDGID' is the unique identifier
                            if (dataItem.isChecked) {
                                $scope.checkedItems.push(itemId);
                               // console.log('Item checked:', itemId); // Log checked item
                            } else {
                                $scope.checkedItems = _.without($scope.checkedItems, itemId);
                               // console.log('Item unchecked:', itemId); // Log unchecked item
                            }
                           // console.log('Currently checked items:', $scope.checkedItems); // Log the updated array

                            if($scope.checkedItems.length > 0)
                                $scope.showGetCheckedItemsButton = true;   
                            else
                                $scope.showGetCheckedItemsButton = false; 
                        };

                           // Initialize and maintain checked states on data bound
                        $scope.esGridOptions.dataBound = function (e) {   
                            if($scope.checkedItems.length > 0){
                                $scope.showGetCheckedItemsButton = true;    
                                var gridData = this.dataSource.data();                            
                                _.each(gridData, function (dataItem) {
                                    dataItem.isChecked = $scope.checkedItems.includes(dataItem.ISUDGID);
                                });
                            }  
                        };

                        $scope.$watch("esGridOptions", function (newV, oldV) {
                            if (
                                newV &&
                                newV.esToolbars &&
                                angular.isArray(newV.esToolbars)
                            ) {
                                var existingtbs = newV.toolbar || [];

                                _.forEach(newV.esToolbars, function (newtb) {
                                    if (
                                        newtb.fnName &&
                                        newtb.fnDef &&
                                        angular.isFunction(newtb.fnDef)
                                    ) {
                                        $scope[newtb.fnName] = newtb.fnDef;
                                    }
                                });
                            }
                        });

                        $scope.esGridPrint = function () {};

                        if (!$scope.esGridOptions && !iAttrs.esGridOptions) {
                            if (!$scope.esGroupId || !$scope.esFilterId) {
                                throw "esGridOptions NOT defined. In order to dynamically get the options you must set GroupID and FilterID for esgrid to work";
                            }
                            // Now esGridOption explicitly assigned so ask the server
                            esWebApiService
                                .fetchPublicQueryInfo(
                                    $scope.esGroupId,
                                    $scope.esFilterId,
                                    true,
                                    true
                                )
                                .then(function (ret) {
                                    var p1 = ret.data;
                                    var p2 =
                                        esWebUIHelper.winGridInfoToESGridInfo(
                                            $scope.esGroupId,
                                            $scope.esFilterId,
                                            p1
                                        );
                                    $scope.esGridOptions =
                                        esWebUIHelper.esGridInfoToKInfo(
                                            $scope.esGroupId,
                                            $scope.esFilterId,
                                            $scope.esExecuteParams,
                                            p2,
                                            $scope.esPQOptions
                                        );
                                    if ($scope.esPostGridOptions) {
                                        angular.merge(
                                            $scope.esGridOptions,
                                            $scope.esPostGridOptions
                                        );
                                    }
                                })
                                .catch(angular.noop);
                        }   
                    },
                };
            },
        ])

        .directive("esGaugePq", [
            "$log",
            "$window",
            "esWebApi",
            "esMessaging",
            "esUIHelper",
            "esGlobals",
            "$timeout",
            function (
                $log,
                $window,
                esWebApiService,
                esMessaging,
                esWebUIHelper,
                esGlobals,
                $timeout
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esPqDef: "=",
                    },
                    templateUrl: function (element, attrs) {
                        return "src/partials/esGaugePQ.html";
                    },
                    link: function ($scope, iElement, iAttrs) {
                        function prepareGauge() {
                            if (
                                !$scope.esRows ||
                                !$scope.esRows.length ||
                                !$scope.esPqDef.UIOptions.pointer
                            ) {
                                return;
                            }

                            function calcPointer(
                                row,
                                minScale,
                                maxScale,
                                ranges
                            ) {
                                row.esScaleOptions = {
                                    min: minScale,
                                    max: maxScale,
                                    ranges: ranges,
                                    labels: $scope.esPqDef.UIOptions.labels,
                                    vertical:
                                        !!$scope.esPqDef.UIOptions.vertical,
                                };

                                var tp = angular.isArray(
                                    $scope.esPqDef.UIOptions.pointer
                                )
                                    ? $scope.esPqDef.UIOptions.pointer
                                    : [$scope.esPqDef.UIOptions.pointer];

                                var pointers = [];
                                var ix;
                                for (ix = 0; ix < tp.length; ix++) {
                                    var poi = angular.merge({}, tp[ix]);
                                    poi.value = row["GValue" + (ix + 1)];
                                    pointers.push(poi);
                                }

                                row.esPointer = pointers;
                            }

                            function evalScale(i, rows) {
                                if (i >= rows.length) {
                                    return;
                                }
                                var row = rows[i];
                                var minScale = 0,
                                    maxScale = 100,
                                    ranges = [{ from: 0, to: 100 }];

                                if (row.GScale) {
                                    esWebApiService
                                        .fetchESScale(row.GScale)
                                        .then(function (ret) {
                                            var scaleObject = ret;

                                            if (
                                                scaleObject &&
                                                scaleObject.Ranges &&
                                                scaleObject.Ranges.length
                                            ) {
                                                minScale = _.minBy(
                                                    scaleObject.Ranges,
                                                    "MinValue"
                                                ).MinValue;
                                                maxScale = _.maxBy(
                                                    scaleObject.Ranges,
                                                    "MaxValue"
                                                ).MaxValue;

                                                ranges = _.map(
                                                    scaleObject.Ranges,
                                                    function (r) {
                                                        var x = {
                                                            from: r.MinValue,
                                                            to: r.MaxValue,
                                                        };

                                                        if (r.ColorARGB) {
                                                            x.color =
                                                                esGlobals.rgbToHex(
                                                                    r.ColorARGB
                                                                );
                                                        }
                                                        return x;
                                                    }
                                                );
                                            }

                                            calcPointer(
                                                row,
                                                minScale,
                                                maxScale,
                                                ranges
                                            );

                                            evalScale(i + 1, rows);
                                        })
                                        .catch(function (err) {
                                            calcPointer(
                                                row,
                                                minScale,
                                                maxScale,
                                                ranges
                                            );

                                            evalScale(i + 1, rows);
                                        });
                                } else {
                                    calcPointer(
                                        row,
                                        minScale,
                                        maxScale,
                                        ranges
                                    );
                                    evalScale(i + 1, rows);
                                }
                            }

                            evalScale(0, $scope.esRows);
                        }

                        $scope.executePQ = function () {
                            esWebApiService
                                .fetchPublicQuery($scope.esPqDef)
                                .then(function (ret) {
                                    if (ret.data.Rows && ret.data.Rows.length) {
                                        $scope.esRows = $scope.esPqDef.UIOptions
                                            .expandRows
                                            ? ret.data.Rows
                                            : [ret.data.Rows[0]];
                                        prepareGauge();
                                    }
                                })
                                .catch(angular.noop);
                        };

                        $scope.esPqDef.runPQ = $scope.executePQ;

                        if (
                            $scope.esPqDef &&
                            $scope.esPqDef.PQOptions &&
                            $scope.esPqDef.PQOptions.AutoExecute
                        ) {
                            $scope.executePQ();
                        }
                    },
                };
            },
        ])

        .directive("esStockChart", [
            "$log",
            "$window",
            "esWebApi",
            "esMessaging",
            "esUIHelper",
            "esGlobals",
            function (
                $log,
                $window,
                esWebApiService,
                esMessaging,
                esWebUIHelper,
                esGlobals
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esPanelOpen: "=?",
                        esPqDef: "=?",
                        esChartOptions: "=",
                        esChartCtrl: "=?",
                        esLocalData: "=?",
                    },
                    templateUrl: function (element, attrs) {
                        return "src/partials/esStockChartPQ.html";
                    },
                    link: function ($scope, iElement, iAttrs) {
                        var ctrlF = function () {
                            return $scope.esChartCtrl;
                        };

                        var onResize = function () {
                            var ctrl = ctrlF();

                            if (ctrl) {
                                ctrl.resize();
                            } else {
                                kendo.resize(
                                    angular.element(".eschart-wrapper")
                                );
                            }
                        };

                        if (!$scope.esLocalData && !iAttrs.esLocalData) {
                            var groups = $scope.esChartOptions
                                ? $scope.esChartOptions.group
                                : null;
                            $scope.esChartDataSource =
                                esWebUIHelper.getPQDataSource(
                                    $scope.esPqDef,
                                    null,
                                    null,
                                    groups,
                                    ctrlF
                                );
                        } else {
                            $scope.esChartDataSource = angular.isArray(
                                $scope.esLocalData
                            )
                                ? { data: $scope.esLocalData }
                                : $scope.esLocalData;
                        }

                        $scope.esChartOptions.dataSource =
                            $scope.esChartDataSource;

                        $scope.executePQ = function () {
                            $scope.esPanelOpen.status = false;
                            if ($scope.esChartDataSource) {
                                $scope.esChartDataSource.read();
                            }
                        };

                        if ($scope.esPqDef) {
                            $scope.esPqDef.runPQ = $scope.executePQ;
                        }

                        $scope.$on("$destroy", function () {
                            angular.element($window).unbind("resize", onResize);
                        });

                        angular.element($window).bind("resize", onResize);
                    },
                };
            },
        ])

        .directive("esChart", [
            "$log",
            "$window",
            "esWebApi",
            "esMessaging",
            "esUIHelper",
            "esGlobals",
            function (
                $log,
                $window,
                esWebApiService,
                esMessaging,
                esWebUIHelper,
                esGlobals
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esPanelOpen: "=?",
                        esPqDef: "=?",
                        esChartOptions: "=",
                        esChartCtrl: "=?",
                        esLocalData: "=?",
                    },
                    templateUrl: function (element, attrs) {
                        return "src/partials/esChartPQ.html";
                    },
                    link: function ($scope, iElement, iAttrs) {
                        var ctrlF = function () {
                            return $scope.esChartCtrl;
                        };

                        var onResize = function () {
                            var ctrl = ctrlF();

                            if (ctrl) {
                                ctrl.resize();
                            } else {
                                kendo.resize(
                                    angular.element(".eschart-wrapper")
                                );
                            }
                        };

                        if (!$scope.esLocalData && !iAttrs.esLocalData) {
                            var groups = $scope.esChartOptions
                                ? $scope.esChartOptions.group
                                : null;
                            $scope.esChartDataSource =
                                esWebUIHelper.getPQDataSource(
                                    $scope.esPqDef,
                                    null,
                                    null,
                                    groups,
                                    ctrlF
                                );
                        } else {
                            $scope.esChartDataSource = {
                                data: $scope.esLocalData,
                            };
                        }

                        $scope.esChartOptions.dataSource =
                            $scope.esChartDataSource;

                        $scope.executePQ = function () {
                            $scope.esPanelOpen.status = false;
                            if ($scope.esChartDataSource) {
                                $scope.esChartDataSource.read();
                            }
                        };

                        $scope.esPqDef.runPQ = $scope.executePQ;

                        $scope.$on("$destroy", function () {
                            angular.element($window).unbind("resize", onResize);
                        });

                        angular.element($window).bind("resize", onResize);
                    },
                };
            },
        ])

        .directive("esGanttPq", [
            "$log",
            "$window",
            "esWebApi",
            "esMessaging",
            "esUIHelper",
            "esGlobals",
            "$translate",
            function (
                $log,
                $window,
                esWebApiService,
                esMessaging,
                esWebUIHelper,
                esGlobals,
                $translate
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esPqDef: "=",
                        esGanttCtrl: "=?",
                    },
                    templateUrl: function (element, attrs) {
                        return "src/partials/esGanttPQ.html";
                    },
                    link: function ($scope, iElement, iAttrs) {
                        var ctrlF = function () {
                            return $scope.esGanttCtrl;
                        };

                        var onResize = function () {
                            var ctrl = ctrlF();

                            if (ctrl) {
                                ctrl.resize();
                            } else {
                                kendo.resize(
                                    angular.element(".eschart-wrapper")
                                );
                            }
                        };

                        $scope.$on("$destroy", function () {
                            angular.element($window).unbind("resize", onResize);
                        });

                        angular.element($window).bind("resize", onResize);

                        $scope.executePQ = function () {
                            $scope.esPqDef.esPanelOpen.status = false;
                            if ($scope.tasksDS) {
                                $scope.tasksDS.read();
                            }
                        };

                        $scope.esPqDef.runPQ = $scope.executePQ;

                        $scope.tasksDS = new kendo.data.GanttDataSource({
                            transport: {
                                error: function (e) {
                                    console.log(e);
                                },

                                read: function (options) {
                                    var pqOptions = {};
                                    pqOptions.WithCount = false;
                                    pqOptions.Page = -1;
                                    pqOptions.PageSize = -1;

                                    var executeParams = $scope.esPqDef.Params;
                                    if (
                                        executeParams instanceof
                                        esGlobals.ESParamValues
                                    ) {
                                        if (!executeParams.isValidState()) {
                                            var err = new Error(
                                                $translate.instant(
                                                    "ESUI.PQ.PARAMS_MISSING"
                                                )
                                            );
                                            options.error(err);
                                            throw err;
                                        }
                                        executeParams =
                                            executeParams.getExecuteVals();
                                    }

                                    esWebApiService
                                        .fetchPublicQuery(
                                            $scope.esPqDef.GroupID,
                                            $scope.esPqDef.FilterID,
                                            pqOptions,
                                            executeParams
                                        )
                                        .then(function (pq) {
                                            if (
                                                pq &&
                                                pq.data &&
                                                pq.data.Rows &&
                                                pq.data.Rows.length
                                            ) {
                                                pq = pq.data.Rows;
                                            } else {
                                                pq = [];
                                            }

                                            options.success(pq);
                                            $scope.resourcesDS.read();
                                        })
                                        .catch(function (err) {
                                            $log.error(
                                                "Error in DataSource ",
                                                err
                                            );
                                            options.error(err);
                                        });
                                },
                            },
                            schema: {
                                model: {
                                    id: "id",
                                    fields: {
                                        id: { from: "Code", type: "string" },
                                        parentId: {
                                            from: "ParentCode",
                                            type: "string",
                                        },
                                        TaskTypeDescription: {
                                            from: "TaskTypeDescription",
                                            type: "string",
                                        },
                                        WPCode: {
                                            from: "WPCode",
                                            type: "string",
                                        },
                                        start: {
                                            from: "StartDate",
                                            type: "date",
                                        },
                                        end: {
                                            from: "FinishDate",
                                            type: "date",
                                        },
                                        title: {
                                            from: "Title",
                                            type: "string",
                                        },
                                        percentComplete: {
                                            from: "Completeness",
                                            type: "number",
                                        },
                                        summary: {
                                            from: "IsSummary",
                                            type: "boolean",
                                        },
                                        expanded: {
                                            from: "Expanded",
                                            type: "boolean",
                                        },
                                    },
                                },
                            },
                        });

                        $scope.resourcesDS = new kendo.data.DataSource({
                            transport: {
                                error: function (e) {
                                    console.log(e);
                                },

                                read: function (options) {
                                    var pqOptions = {};
                                    pqOptions.WithCount = false;
                                    pqOptions.Page = -1;
                                    pqOptions.PageSize = -1;

                                    var executeParams = $scope.esPqDef.Params;
                                    if (
                                        executeParams instanceof
                                        esGlobals.ESParamValues
                                    ) {
                                        if (!executeParams.isValidState()) {
                                            var err = new Error(
                                                $translate.instant(
                                                    "ESUI.PQ.PARAMS_MISSING"
                                                )
                                            );
                                            options.error(err);
                                            throw err;
                                        }
                                        executeParams =
                                            executeParams.getExecuteVals();
                                    }

                                    var sG = $scope.esPqDef.GroupID;
                                    var fG = "ProjectTaskResources";
                                    if (
                                        $scope.esPqDef.UIOptions &&
                                        angular.isString(
                                            $scope.esPqDef.UIOptions
                                                .ProjectTaskResourcesPQ
                                        )
                                    ) {
                                        var parts =
                                            $scope.esPqDef.UIOptions.ProjectTaskAssignmentsPQ.split(
                                                ","
                                            );
                                        parts[0] = parts[0].trim();
                                        if (parts[0]) {
                                            sG = parts[0];
                                        }
                                        if (parts.length > 1) {
                                            parts[1] = parts[1].trim();
                                            if (parts[1]) {
                                                fG = parts[1];
                                            }
                                        }
                                    }
                                    esWebApiService
                                        .fetchPublicQuery(
                                            sG,
                                            fG,
                                            pqOptions,
                                            executeParams
                                        )
                                        .then(function (pq) {
                                            if (
                                                pq &&
                                                pq.data &&
                                                pq.data.Rows &&
                                                pq.data.Rows.length
                                            ) {
                                                pq = pq.data.Rows;
                                            } else {
                                                pq = [];
                                            }
                                            options.success(pq);
                                            $scope.assignmentsDS.read();
                                        })
                                        .catch(function (err) {
                                            $log.error(
                                                "Error in DataSource ",
                                                err
                                            );
                                            options.error(err);
                                        });
                                },
                            },
                            schema: {
                                model: {
                                    id: "id",
                                    fields: {
                                        id: { from: "Code", type: "string" },
                                        Name: { from: "Name", type: "string" },
                                        Color: {
                                            from: "Color",
                                            type: "string",
                                        },
                                    },
                                },
                            },
                        });

                        $scope.assignmentsDS = new kendo.data.DataSource({
                            transport: {
                                error: function (e) {
                                    console.log(e);
                                },

                                read: function (options) {
                                    var pqOptions = {};
                                    pqOptions.WithCount = false;
                                    pqOptions.Page = -1;
                                    pqOptions.PageSize = -1;

                                    var executeParams = $scope.esPqDef.Params;
                                    if (
                                        executeParams instanceof
                                        esGlobals.ESParamValues
                                    ) {
                                        if (!executeParams.isValidState()) {
                                            var err = new Error(
                                                $translate.instant(
                                                    "ESUI.PQ.PARAMS_MISSING"
                                                )
                                            );
                                            options.error(err);
                                            throw err;
                                        }
                                        executeParams =
                                            executeParams.getExecuteVals();
                                    }

                                    var sG = $scope.esPqDef.GroupID;
                                    var fG = "ProjectTaskAssignments";
                                    if (
                                        $scope.esPqDef.UIOptions &&
                                        angular.isString(
                                            $scope.esPqDef.UIOptions
                                                .ProjectTaskAssignmentsPQ
                                        )
                                    ) {
                                        var parts =
                                            $scope.esPqDef.UIOptions.ProjectTaskAssignmentsPQ.split(
                                                ","
                                            );
                                        parts[0] = parts[0].trim();
                                        if (parts[0]) {
                                            sG = parts[0];
                                        }
                                        if (parts.length > 1) {
                                            parts[1] = parts[1].trim();
                                            if (parts[1]) {
                                                fG = parts[1];
                                            }
                                        }
                                    }

                                    esWebApiService
                                        .fetchPublicQuery(
                                            sG,
                                            fG,
                                            pqOptions,
                                            executeParams
                                        )
                                        .then(function (pq) {
                                            if (
                                                pq &&
                                                pq.data &&
                                                pq.data.Rows &&
                                                pq.data.Rows.length
                                            ) {
                                                pq = pq.data.Rows;
                                            } else {
                                                pq = [];
                                            }
                                            options.success(pq);
                                        })
                                        .catch(function (err) {
                                            $log.error(
                                                "Error in DataSource ",
                                                err
                                            );
                                            options.error(err);
                                        });
                                },
                            },
                            schema: {
                                model: {
                                    id: "ID",
                                    fields: {
                                        ID: { from: "GID", type: "string" },
                                        ResourceID: {
                                            from: "Code",
                                            type: "string",
                                        },
                                        Units: {
                                            from: "ResourceUsage",
                                            type: "number",
                                        },
                                        TaskID: {
                                            from: "TaskCode",
                                            type: "string",
                                        },
                                    },
                                },
                            },
                        });

                        $scope.esGanttOptions = {
                            toolbar: [{ name: "pdf" }],
                            dataSource: $scope.tasksDS,
                            assignments: {
                                dataTaskIdField: "TaskID",
                                dataResourceIdField: "ResourceID",
                                dataValueField: "Units",
                                dataSource: $scope.assignmentsDS,
                            },
                            resources: {
                                field: "Resources",
                                dataColorField: "Color",
                                dataTextField: "Name",
                                dataSource: $scope.resourcesDS,
                            },
                            views: [
                                "day",
                                {
                                    type: "week",
                                    dayHeaderTemplate: kendo.template(
                                        "#=kendo.toString(start, 'ddd d/M')#"
                                    ),
                                    weekHeaderTemplate:
                                        "#=kendo.toString(start, 'dddd d/M')# - #=kendo.toString(kendo.date.addDays(end, -1), 'dddd d/M')#",
                                    selected: true,
                                },
                                {
                                    type: "month",
                                    weekHeaderTemplate:
                                        "#=kendo.toString(start, 'ddd d/M')# - #=kendo.toString(kendo.date.addDays(end, -1), 'ddd d/M')#",
                                    monthHeaderTemplate:
                                        "#=kendo.toString(start, 'MMMM yyyy')#",
                                },
                            ],
                            columns: [
                                {
                                    field: "title",
                                    title: $translate.instant(
                                        "ESUI.PROJECT.COL_TITLE"
                                    ),
                                    width: 200,
                                },
                                {
                                    field: "start",
                                    title: $translate.instant(
                                        "ESUI.PROJECT.START_TITLE"
                                    ),
                                    format: "{0:dd/MM/yyyy}",
                                    width: 100,
                                },
                                {
                                    field: "end",
                                    title: $translate.instant(
                                        "ESUI.PROJECT.END_TITLE"
                                    ),
                                    format: "{0:dd/MM/yyyy}",
                                    width: 100,
                                },
                                {
                                    field: "Resources",
                                    title: $translate.instant(
                                        "ESUI.PROJECT.RES_TITLE"
                                    ),
                                    width: 400,
                                },
                                {
                                    field: "id",
                                    title: $translate.instant(
                                        "ESUI.PROJECT.ID_TITLE"
                                    ),
                                    width: 100,
                                },
                                {
                                    field: "TaskTypeDescription",
                                    title: $translate.instant(
                                        "ESUI.PROJECT.TTYPE_TITLE"
                                    ),
                                    width: 200,
                                },
                                {
                                    field: "WPCode",
                                    title: $translate.instant(
                                        "ESUI.PROJECT.WP_TITLE"
                                    ),
                                    width: 100,
                                    defaultValue: "",
                                },
                            ],
                            height: 800,
                            autoBind: false,
                            resizable: true,
                            columnResizeHandleWidth: 6,
                            navigatable: true,
                            showWorkHours: false,
                            showWorkDays: false,
                        };

                        if (
                            $scope.esPqDef &&
                            $scope.esPqDef.PQOptions &&
                            $scope.esPqDef.PQOptions.AutoExecute
                        ) {
                            $scope.executePQ();
                        }
                    },
                };
            },
        ])

        .directive("esTimelinePq", [
            "$log",
            "$window",
            "$timeout",
            "esWebApi",
            "esMessaging",
            "esUIHelper",
            "esGlobals",
            "$translate",
            function (
                $log,
                $window,
                $timeout,
                esWebApiService,
                esMessaging,
                esWebUIHelper,
                esGlobals,
                $translate
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esPqDef: "=",
                        esTimelineCtrl: "=?",
                    },
                    templateUrl: function (element, attrs) {
                        return "src/partials/esTimelinePQ.html";
                    },
                    link: function ($scope, iElement, iAttrs) {
                        var ctrlF = function () {
                            return $scope.esTimelineCtrl;
                        };

                        var onResize = function () {
                            var ctrl = ctrlF();

                            if (ctrl) {
                                ctrl.resize();
                            } else {
                                kendo.resize(
                                    angular.element(".estimeline-wrapper")
                                );
                            }
                        };

                        $scope.$on("$destroy", function () {
                            angular.element($window).unbind("resize", onResize);
                        });

                        angular.element($window).bind("resize", onResize);

                        $scope.entityDS = {};

                        $scope.executePQ = function () {
                            $scope.esPqDef.esPanelOpen.status = false;
                            if ($scope.esTimelineCtrl) {
                                $scope.esTimelineCtrl.setDataSource(runDS());
                            }
                        };

                        $scope.esPqDef.runPQ = $scope.executePQ;

                        $scope.getImageUrl = function (val) {
                            return esResolveBlobUrl(val, esWebApiService);
                        };

                        $scope.toHeaderDateString = function (date) {
                            if (date instanceof Date)
                                return kendo.toString(date, "d MMM yyyy");
                            else
                                return kendo.toString(
                                    new Date(date),
                                    "d MMM yyyy"
                                );
                        };

                        var runDS = function () {
                            return new kendo.data.DataSource({
                                transport: {
                                    error: function (e) {
                                        console.log(e);
                                    },

                                    read: function (options) {
                                        var pqOptions = {};
                                        pqOptions.WithCount = false;
                                        pqOptions.Page = -1;
                                        pqOptions.PageSize = -1;

                                        var executeParams =
                                            $scope.esPqDef.Params;
                                        if (
                                            executeParams instanceof
                                            esGlobals.ESParamValues
                                        ) {
                                            if (!executeParams.isValidState()) {
                                                var err = new Error(
                                                    $translate.instant(
                                                        "ESUI.PQ.PARAMS_MISSING"
                                                    )
                                                );
                                                options.error(err);
                                                throw err;
                                            }
                                            executeParams =
                                                executeParams.getExecuteVals();
                                        }

                                        esWebApiService
                                            .fetchPublicQuery(
                                                $scope.esPqDef.GroupID,
                                                $scope.esPqDef.FilterID,
                                                pqOptions,
                                                executeParams
                                            )
                                            .then(function (pq) {
                                                if (
                                                    pq &&
                                                    pq.data &&
                                                    pq.data.Rows &&
                                                    pq.data.Rows.length
                                                ) {
                                                    pq = pq.data.Rows;
                                                } else {
                                                    pq = [];
                                                }

                                                $scope.timelineDS = pq;

                                                $scope.oldestEvent =
                                                    pq.length > 0
                                                        ? pq.reduce(function (
                                                              prev,
                                                              current
                                                          ) {
                                                              return prev.Date <
                                                                  current.Date
                                                                  ? prev
                                                                  : current;
                                                          })
                                                        : null;
                                                $scope.newestEvent =
                                                    pq.length > 0
                                                        ? pq.reduce(function (
                                                              prev,
                                                              current
                                                          ) {
                                                              return prev.Date >
                                                                  current.Date
                                                                  ? prev
                                                                  : current;
                                                          })
                                                        : null;

                                                var sG = $scope.esPqDef.GroupID;
                                                var fG =
                                                    "TimelineBusinessAccountInfo";
                                                if (
                                                    $scope.esPqDef.UIOptions &&
                                                    angular.isString(
                                                        $scope.esPqDef.UIOptions
                                                            .TimelineEntityInfoPQ
                                                    )
                                                ) {
                                                    var parts =
                                                        $scope.esPqDef.UIOptions.TimelineEntityInfoPQ.split(
                                                            ","
                                                        );
                                                    parts[0] = parts[0].trim();
                                                    if (parts[0]) {
                                                        sG = parts[0];
                                                    }
                                                    if (parts.length > 1) {
                                                        parts[1] =
                                                            parts[1].trim();
                                                        if (parts[1]) {
                                                            fG = parts[1];
                                                        }
                                                    }
                                                }

                                                esWebApiService
                                                    .fetchPublicQuery(
                                                        sG,
                                                        fG,
                                                        pqOptions,
                                                        executeParams
                                                    )
                                                    .then(function (master) {
                                                        if (
                                                            master &&
                                                            master.data &&
                                                            master.data.Rows &&
                                                            master.data.Rows
                                                                .length
                                                        ) {
                                                            $scope.entityDS =
                                                                master.data.Rows[0];
                                                        } else {
                                                            $scope.entityDS =
                                                                {};
                                                        }
                                                    })
                                                    .catch(function (err) {
                                                        $scope.entityDS = {};
                                                    });

                                                options.success(pq);
                                            })
                                            .catch(function (err) {
                                                $log.error(
                                                    "Error in DataSource ",
                                                    err
                                                );
                                                $scope.entityDS = {};
                                                options.error(err);
                                            });
                                    },
                                },
                                serverSorting: true,
                                serverFiltering: false,
                                schema: {
                                    model: {
                                        fields: {
                                            date: {
                                                from: "Date",
                                                type: "date",
                                            },
                                            title: {
                                                from: "Title",
                                                type: "string",
                                            },
                                            titleAmount: {
                                                from: "TitleAmount",
                                                type: "number",
                                            },
                                            priority: {
                                                from: "Priority",
                                                type: "number",
                                            },
                                            latitude: {
                                                from: "Latitude",
                                                type: "number",
                                            },
                                            longitude: {
                                                from: "Longitude",
                                                type: "number",
                                            },
                                            qualifier: {
                                                from: "Qualifier",
                                                type: "number",
                                            },
                                            subtitle: {
                                                from: "SubTitle",
                                                type: "string",
                                            },
                                            description: {
                                                from: "Body",
                                                type: "string",
                                            },
                                            additionalInfo: {
                                                from: "AdditionalInfo",
                                                type: "string",
                                            },
                                            formid: {
                                                from: "FormID",
                                                type: "string",
                                            },
                                            fGID: {
                                                from: "fGID",
                                                type: "string",
                                            },
                                        },
                                    },
                                },
                            });
                        };

                        var opts = {
                            orientation: "vertical",
                            alternatingMode: true,
                            collapsibleEvents: true,
                            dateFormat: "dddd, d MMM yyyy",
                            eventTemplate:
                                '<div class="timeline-event-container" data-priority="#= data.priority #">' +
                                '   <div class="k-card-header">' +
                                '       <h5 class="k-card-title" title="#= data.title #">' +
                                '           <span class="k-event-title"><i class="mdi mdi-#= ["help-circle", "calendar-check", "email", "emoticon-sad-outline", "telescope", "file-document-box-check-outline", "receipt", "truck", "file-document-box-minus-outline", "cash-multiple"][data.qualifier <= 8 ? data.qualifier + 1 : 0] #"></i> #= data.title #</span>' +
                                '           <span class="k-event-collapse k-button k-button-icon k-flat"><span class="k-icon k-i-arrow-chevron-right"></span></span>' +
                                "       </h5>" +
                                '       <h6 class="k-card-subtitle"><span>#= data.subtitle #</span><span class="amount">#= data.titleAmount ? kendo.toString(data.titleAmount, "c") : data.date && (data.date.getHours() + data.date.getMinutes() > 0) ? kendo.toString(data.date, "HH:mm") : "" #</span></h6>' +
                                "           # if (data.additionalInfo) { #" +
                                '           <h6 class="k-card-subtitle">#= data.additionalInfo #</h6>' +
                                "           # } #" +
                                "   </div>" +
                                '   <div class="k-card-body">' +
                                "       # if (data.description) { #" +
                                '       <div class="k-card-description">' +
                                "           # if (data.description) { #" +
                                "           <p>#= data.description #</p>" +
                                "           # } #" +
                                "       </div>" +
                                "       # } #" +
                                "       # if (data.images && data.images.length > 0) { #" +
                                '       <div class="images-container">' +
                                "           # for (var i = 0 ; i < data.images.length ; i++) { #" +
                                '           <img src="#= data.images[i].src #" class="k-card-image">' +
                                "           # } #" +
                                "       </div>" +
                                "       # } #" +
                                "       # if (data.latitude && data.longitude) { #" +
                                '       <div class="map-container"></div>' +
                                "       # } #" +
                                "   </div>" +
                                "   # if (data.actions && data.actions.length > 0) { #" +
                                '   <div class="k-card-actions">' +
                                "       # for (var i = 0 ; i < data.actions.length ; i++) { #" +
                                '       <a class="k-button k-flat k-primary" href="javascript:;">#= data.actions[i].text #</a>' +
                                "       # } #" +
                                "   </div>" +
                                "   # } #" +
                                "</div>",
                            dataBound: function (e) {
                                $(".timeline-event-container").each(
                                    function () {
                                        var $this = $(this);

                                        $this
                                            .closest(".k-timeline-event")
                                            .addClass(
                                                "k-timeline-event-priority-" +
                                                    ($this.data("priority") ||
                                                        0)
                                            );

                                        if (
                                            $.trim(
                                                $this
                                                    .find(".k-card-body")
                                                    .html()
                                            ) === ""
                                        )
                                            $this.addClass(
                                                "timeline-event-container-nobody"
                                            );
                                    }
                                );
                            },
                            expand: function (e) {
                                var $eventContainer = $(
                                    '.k-timeline-event[data-uid="' +
                                        e.dataItem.uid +
                                        '"] .timeline-event-container'
                                );
                                var $mapContainer =
                                    $eventContainer.find(".map-container");

                                if (
                                    e.dataItem.latitude != null &&
                                    e.dataItem.longitude != null &&
                                    $mapContainer.data("kendoMap") == null
                                ) {
                                    $mapContainer.kendoMap({
                                        layers: [
                                            {
                                                type: "tile",
                                                urlTemplate:
                                                    "https://a.tile.openstreetmap.org/#= zoom #/#= x #/#= y #.png",
                                                attribution:
                                                    "&copy; OpenStreetMap",
                                            },
                                        ],
                                        center: [
                                            e.dataItem.latitude,
                                            e.dataItem.longitude,
                                        ],
                                        zoom: 15,
                                        markers: [
                                            {
                                                location: [
                                                    e.dataItem.latitude,
                                                    e.dataItem.longitude,
                                                ],
                                            },
                                        ],
                                    });
                                }
                            },
                        };

                        if (
                            $scope.esPqDef &&
                            $scope.esPqDef.PQOptions &&
                            $scope.esPqDef.PQOptions.AutoExecute
                        ) {
                            opts.dataSource = runDS();
                        }

                        $scope.esTimelineOptions = opts;
                    },
                };
            },
        ])

        .directive("esCalendarPq", [
            "$log",
            "$window",
            "esWebApi",
            "esMessaging",
            "esUIHelper",
            "esGlobals",
            "$translate",
            function (
                $log,
                $window,
                esWebApiService,
                esMessaging,
                esWebUIHelper,
                esGlobals,
                $translate
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esPqDef: "=",
                        esCalendarCtrl: "=?",
                    },
                    templateUrl: function (element, attrs) {
                        return "src/partials/esGanttPQ.html";
                    },
                    link: function ($scope, iElement, iAttrs) {
                        var ctrlF = function () {
                            return $scope.esGanttCtrl;
                        };

                        var onResize = function () {
                            var ctrl = ctrlF();

                            if (ctrl) {
                                ctrl.resize();
                            } else {
                                kendo.resize(
                                    angular.element(".escalendar-wrapper")
                                );
                            }
                        };

                        $scope.$on("$destroy", function () {
                            angular.element($window).unbind("resize", onResize);
                        });

                        angular.element($window).bind("resize", onResize);

                        $scope.executePQ = function () {
                            $scope.esPqDef.esPanelOpen.status = false;
                            if ($scope.tasksDS) {
                                $scope.tasksDS.read();
                            }
                        };

                        $scope.esPqDef.runPQ = $scope.executePQ;

                        $scope.tasksDS = new kendo.data.GanttDataSource({
                            transport: {
                                error: function (e) {
                                    console.log(e);
                                },

                                read: function (options) {
                                    var pqOptions = {};
                                    pqOptions.WithCount = false;
                                    pqOptions.Page = -1;
                                    pqOptions.PageSize = -1;

                                    var executeParams = $scope.esPqDef.Params;
                                    if (
                                        executeParams instanceof
                                        esGlobals.ESParamValues
                                    ) {
                                        if (!executeParams.isValidState()) {
                                            var err = new Error(
                                                $translate.instant(
                                                    "ESUI.PQ.PARAMS_MISSING"
                                                )
                                            );
                                            options.error(err);
                                            throw err;
                                        }
                                        executeParams =
                                            executeParams.getExecuteVals();
                                    }

                                    esWebApiService
                                        .fetchPublicQuery(
                                            $scope.esPqDef.GroupID,
                                            $scope.esPqDef.FilterID,
                                            pqOptions,
                                            executeParams
                                        )
                                        .then(function (pq) {
                                            if (
                                                pq &&
                                                pq.data &&
                                                pq.data.Rows &&
                                                pq.data.Rows.length
                                            ) {
                                                pq = pq.data.Rows;
                                            } else {
                                                pq = [];
                                            }

                                            options.success(pq);
                                            $scope.resourcesDS.read();
                                        })
                                        .catch(function (err) {
                                            $log.error(
                                                "Error in DataSource ",
                                                err
                                            );
                                            options.error(err);
                                        });
                                },
                            },
                            schema: {
                                model: {
                                    id: "id",
                                    fields: {
                                        id: { from: "Code", type: "string" },
                                        parentId: {
                                            from: "ParentCode",
                                            type: "string",
                                        },
                                        TaskTypeDescription: {
                                            from: "TaskTypeDescription",
                                            type: "string",
                                        },
                                        WPCode: {
                                            from: "WPCode",
                                            type: "string",
                                        },
                                        start: {
                                            from: "StartDate",
                                            type: "date",
                                        },
                                        end: {
                                            from: "FinishDate",
                                            type: "date",
                                        },
                                        title: {
                                            from: "Title",
                                            type: "string",
                                        },
                                        percentComplete: {
                                            from: "Completeness",
                                            type: "number",
                                        },
                                        summary: {
                                            from: "IsSummary",
                                            type: "boolean",
                                        },
                                        expanded: {
                                            from: "Expanded",
                                            type: "boolean",
                                        },
                                    },
                                },
                            },
                        });

                        $scope.resourcesDS = new kendo.data.DataSource({
                            transport: {
                                error: function (e) {
                                    console.log(e);
                                },

                                read: function (options) {
                                    var pqOptions = {};
                                    pqOptions.WithCount = false;
                                    pqOptions.Page = -1;
                                    pqOptions.PageSize = -1;

                                    var executeParams = $scope.esPqDef.Params;
                                    if (
                                        executeParams instanceof
                                        esGlobals.ESParamValues
                                    ) {
                                        if (!executeParams.isValidState()) {
                                            var err = new Error(
                                                $translate.instant(
                                                    "ESUI.PQ.PARAMS_MISSING"
                                                )
                                            );
                                            options.error(err);
                                            throw err;
                                        }
                                        executeParams =
                                            executeParams.getExecuteVals();
                                    }

                                    var sG = $scope.esPqDef.GroupID;
                                    var fG = "ProjectTaskResources";
                                    if (
                                        $scope.esPqDef.UIOptions &&
                                        angular.isString(
                                            $scope.esPqDef.UIOptions
                                                .ProjectTaskResourcesPQ
                                        )
                                    ) {
                                        var parts =
                                            $scope.esPqDef.UIOptions.ProjectTaskAssignmentsPQ.split(
                                                ","
                                            );
                                        parts[0] = parts[0].trim();
                                        if (parts[0]) {
                                            sG = parts[0];
                                        }
                                        if (parts.length > 1) {
                                            parts[1] = parts[1].trim();
                                            if (parts[1]) {
                                                fG = parts[1];
                                            }
                                        }
                                    }
                                    esWebApiService
                                        .fetchPublicQuery(
                                            sG,
                                            fG,
                                            pqOptions,
                                            executeParams
                                        )
                                        .then(function (pq) {
                                            if (
                                                pq &&
                                                pq.data &&
                                                pq.data.Rows &&
                                                pq.data.Rows.length
                                            ) {
                                                pq = pq.data.Rows;
                                            } else {
                                                pq = [];
                                            }
                                            options.success(pq);
                                            $scope.assignmentsDS.read();
                                        })
                                        .catch(function (err) {
                                            $log.error(
                                                "Error in DataSource ",
                                                err
                                            );
                                            options.error(err);
                                        });
                                },
                            },
                            schema: {
                                model: {
                                    id: "id",
                                    fields: {
                                        id: { from: "Code", type: "string" },
                                        Name: { from: "Name", type: "string" },
                                        Color: {
                                            from: "Color",
                                            type: "string",
                                        },
                                    },
                                },
                            },
                        });

                        $scope.assignmentsDS = new kendo.data.DataSource({
                            transport: {
                                error: function (e) {
                                    console.log(e);
                                },

                                read: function (options) {
                                    var pqOptions = {};
                                    pqOptions.WithCount = false;
                                    pqOptions.Page = -1;
                                    pqOptions.PageSize = -1;

                                    var executeParams = $scope.esPqDef.Params;
                                    if (
                                        executeParams instanceof
                                        esGlobals.ESParamValues
                                    ) {
                                        if (!executeParams.isValidState()) {
                                            var err = new Error(
                                                $translate.instant(
                                                    "ESUI.PQ.PARAMS_MISSING"
                                                )
                                            );
                                            options.error(err);
                                            throw err;
                                        }
                                        executeParams =
                                            executeParams.getExecuteVals();
                                    }

                                    var sG = $scope.esPqDef.GroupID;
                                    var fG = "ProjectTaskAssignments";
                                    if (
                                        $scope.esPqDef.UIOptions &&
                                        angular.isString(
                                            $scope.esPqDef.UIOptions
                                                .ProjectTaskAssignmentsPQ
                                        )
                                    ) {
                                        var parts =
                                            $scope.esPqDef.UIOptions.ProjectTaskAssignmentsPQ.split(
                                                ","
                                            );
                                        parts[0] = parts[0].trim();
                                        if (parts[0]) {
                                            sG = parts[0];
                                        }
                                        if (parts.length > 1) {
                                            parts[1] = parts[1].trim();
                                            if (parts[1]) {
                                                fG = parts[1];
                                            }
                                        }
                                    }

                                    esWebApiService
                                        .fetchPublicQuery(
                                            sG,
                                            fG,
                                            pqOptions,
                                            executeParams
                                        )
                                        .then(function (pq) {
                                            if (
                                                pq &&
                                                pq.data &&
                                                pq.data.Rows &&
                                                pq.data.Rows.length
                                            ) {
                                                pq = pq.data.Rows;
                                            } else {
                                                pq = [];
                                            }
                                            options.success(pq);
                                        })
                                        .catch(function (err) {
                                            $log.error(
                                                "Error in DataSource ",
                                                err
                                            );
                                            options.error(err);
                                        });
                                },
                            },
                            schema: {
                                model: {
                                    id: "ID",
                                    fields: {
                                        ID: { from: "GID", type: "string" },
                                        ResourceID: {
                                            from: "Code",
                                            type: "string",
                                        },
                                        Units: {
                                            from: "ResourceUsage",
                                            type: "number",
                                        },
                                        TaskID: {
                                            from: "TaskCode",
                                            type: "string",
                                        },
                                    },
                                },
                            },
                        });

                        $scope.esGanttOptions = {
                            dataSource: $scope.tasksDS,
                            assignments: {
                                dataTaskIdField: "TaskID",
                                dataResourceIdField: "ResourceID",
                                dataValueField: "Units",
                                dataSource: $scope.assignmentsDS,
                            },
                            resources: {
                                field: "Resources",
                                dataColorField: "Color",
                                dataTextField: "Name",
                                dataSource: $scope.resourcesDS,
                            },
                            views: [
                                "day",
                                { type: "week", selected: true },
                                "month",
                            ],
                            columns: [
                                {
                                    field: "title",
                                    title: $translate.instant(
                                        "ESUI.PROJECT.COL_TITLE"
                                    ),
                                    width: 200,
                                },
                                {
                                    field: "start",
                                    title: $translate.instant(
                                        "ESUI.PROJECT.START_TITLE"
                                    ),
                                    format: "{0:dd/MM/yyyy}",
                                    width: 100,
                                },
                                {
                                    field: "end",
                                    title: $translate.instant(
                                        "ESUI.PROJECT.END_TITLE"
                                    ),
                                    format: "{0:dd/MM/yyyy}",
                                    width: 100,
                                },
                                {
                                    field: "Resources",
                                    title: $translate.instant(
                                        "ESUI.PROJECT.RES_TITLE"
                                    ),
                                    width: 400,
                                },
                                {
                                    field: "id",
                                    title: $translate.instant(
                                        "ESUI.PROJECT.ID_TITLE"
                                    ),
                                    width: 100,
                                },
                                {
                                    field: "TaskTypeDescription",
                                    title: $translate.instant(
                                        "ESUI.PROJECT.TTYPE_TITLE"
                                    ),
                                    width: 200,
                                },
                                {
                                    field: "WPCode",
                                    title: $translate.instant(
                                        "ESUI.PROJECT.WP_TITLE"
                                    ),
                                    width: 100,
                                    defaultValue: "",
                                },
                            ],
                            height: 800,
                            autoBind: false,
                            resizable: true,
                            columnResizeHandleWidth: 6,
                            navigatable: true,
                            showWorkHours: false,
                            showWorkDays: false,
                        };

                        if (
                            $scope.esPqDef &&
                            $scope.esPqDef.PQOptions &&
                            $scope.esPqDef.PQOptions.AutoExecute
                        ) {
                            $scope.executePQ();
                        }
                    },
                };
            },
        ])

        .directive("esSanKeyPq", [
            "$log",
            "$window",
            "$uibModal",
            "$timeout",
            "esWebApi",
            "esMessaging",
            "esUIHelper",
            "esGlobals",
            function (
                $log,
                $window,
                $uibModal,
                $timeout,
                esWebApiService,
                esMessaging,
                esWebUIHelper,
                esGlobals
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esPqDef: "=",
                    },
                    templateUrl: function (element, attrs) {
                        return "src/partials/esSanKeyPQ.html";
                    },
                    link: {
                        pre: function ($scope, iElement, iAttrs) {
                            $scope.executePQ = function () {
                                $scope.esPqDef.esPanelOpen.status = false;
                                if ($scope.sankeyCtrl) {
                                    $scope.sankeyCtrl.showLoadingIndicator();
                                }

                                esWebApiService
                                    .fetchPublicQuery($scope.esPqDef)
                                    .then(function (pq) {
                                        var dt = pq.data.Rows;

                                        $scope.UIOptions.dataSource.length = 0;
                                        var g = 0;
                                        for (g = 0; g < dt.length; g++) {
                                            $scope.UIOptions.dataSource.push(
                                                dt[g]
                                            );
                                        }

                                        if ($scope.sankeyCtrl) {
                                            $scope.sankeyCtrl
                                                .getDataSource()
                                                .reload();
                                            $scope.sankeyCtrl.hideLoadingIndicator();
                                        }
                                    })
                                    .catch(function (err) {
                                        $scope.UIOptions.dataSource.length = 0;
                                        if ($scope.sankeyCtrl) {
                                            $scope.sankeyCtrl
                                                .getDataSource()
                                                .reload();
                                            $scope.sankeyCtrl.hideLoadingIndicator();
                                        }
                                    });
                            };

                            var options = {
                                dataSource: [],
                                sourceField: "FromDimension",
                                targetField: "ToDimension",
                                weightField: "Weight",
                                link: {
                                    colorMode: "gradient",
                                },
                                onInitialized: function (e) {
                                    $scope.sankeyCtrl = e.component;
                                },
                                onIncidentOccurred: function (e) {
                                    if (e.target && e.target.type == "error") {
                                        esMessaging.publish(
                                            "ES_SANKEY_INCIDENT_OCCURED",
                                            e
                                        );
                                    }
                                },
                                tooltip: {
                                    enabled: true,
                                },
                            };

                            var scr = $scope.esPqDef.UIOptions;
                            if (scr) {
                                angular.merge(options, scr);
                            }

                            $scope.UIOptions = options;
                            $scope.esPqDef.runPQ = $scope.executePQ;

                            $scope.$on("$destroy", function () {
                                angular
                                    .element($window)
                                    .unbind("resize", resizeSanKey);
                            });

                            var resizeSanKey = function () {
                                if ($scope.sankeyCtrl) {
                                    $scope.sankeyCtrl.render();
                                }
                            };

                            angular
                                .element($window)
                                .bind("resize", resizeSanKey);

                            esWebApiService
                                .fetchPublicQueryInfo($scope.esPqDef)
                                .then(function (ret) {
                                    var v =
                                        esWebUIHelper.winGridInfoToESGridInfo(
                                            $scope.esPqDef.GroupID,
                                            $scope.esPqDef.FilterID,
                                            ret.data
                                        );

                                    var tp = {
                                        enabled: true,
                                        customizeLinkTooltip: function (info) {
                                            var ts =
                                                "<b>" +
                                                _.find(v.columns, {
                                                    field: $scope.UIOptions
                                                        .sourceField,
                                                }).title +
                                                ":</b> " +
                                                info.source +
                                                "<br/><b>" +
                                                _.find(v.columns, {
                                                    field: $scope.UIOptions
                                                        .targetField,
                                                }).title +
                                                ":</b> " +
                                                info.target +
                                                "<br/>" +
                                                "<b>" +
                                                _.find(v.columns, {
                                                    field: $scope.UIOptions
                                                        .weightField,
                                                }).title +
                                                ":</b> " +
                                                info.weight;
                                            return {
                                                html: ts,
                                            };
                                        },
                                    };
                                    if ($scope.sankeyCtrl) {
                                        $scope.sankeyCtrl.option("tooltip", tp);
                                        $scope.sankeyCtrl.option(
                                            "title",
                                            v.caption
                                        );
                                    }
                                })
                                .catch(function (err) {
                                    $log.error(err);
                                });

                            if (
                                $scope.esPqDef &&
                                $scope.esPqDef.PQOptions &&
                                $scope.esPqDef.PQOptions.AutoExecute
                            ) {
                                $scope.executePQ();
                            }
                        },
                    },
                };
            },
        ])

        .directive("esCardPq", [
            "$log",
            "$window",
            "$uibModal",
            "$timeout",
            "esWebApi",
            "esMessaging",
            "esUIHelper",
            "esGlobals",
            function (
                $log,
                $window,
                $uibModal,
                $timeout,
                esWebApiService,
                esMessaging,
                esWebUIHelper,
                esGlobals
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esPqDef: "=",
                    },
                    templateUrl: function (element, attrs) {
                        return "src/partials/esCardPQ.html";
                    },
                    link: function ($scope, iElement, iAttrs) {
                        $scope.executePQ = function () {
                            $scope.esPqDef.esPanelOpen.status = false;
                            $scope.cardDataSource.page(1);
                        };

                        $scope.esPqDef.runPQ = $scope.executePQ;

                        var options = {
                            headerField: "",
                            titleField: "",
                            footerField: "",
                            imageField: "",
                            tagField: "",
                            simpleView: false,
                        };

                        var scr = $scope.esPqDef.UIOptions;
                        if (scr) {
                            angular.merge(options, scr);
                        }

                        $scope.UIOptions = options;

                        var dsOptions = {
                            serverGrouping: false,
                            serverSorting: false,
                            serverFiltering: false,
                            serverAggregates: false,
                            serverPaging: $scope.esPqDef.PQOptions
                                ? angular.isDefined(
                                      $scope.esPqDef.PQOptions.ServerPaging
                                  )
                                    ? $scope.esPqDef.PQOptions.ServerPaging
                                    : true
                                : true,
                            pageSize:
                                ($scope.esPqDef.PQOptions
                                    ? $scope.esPqDef.PQOptionsPageSize
                                    : null) || 20,
                        };
                        $scope.cardDataSource = esWebUIHelper.getPQDataSource(
                            $scope.esPqDef,
                            dsOptions
                        );

                        var xFields = null;

                        $scope.bodyFields = function () {
                            if (xFields) {
                                return xFields;
                            }
                            var reserved = [
                                $scope.UIOptions.headerField,
                                $scope.UIOptions.titleField,
                                $scope.UIOptions.footerField,
                                $scope.UIOptions.imageField,
                                $scope.UIOptions.tagField,
                                "Longitude",
                                "Latitude",
                            ];

                            if (
                                !$scope.esPqDef.esGridOptions ||
                                !$scope.esPqDef.esGridOptions.columns
                            ) {
                                return [];
                            }

                            xFields = _.filter(
                                $scope.esPqDef.esGridOptions.columns,
                                function (l) {
                                    return reserved.indexOf(l.field) == -1;
                                }
                            );
                            return xFields;
                        };

                        $scope.getTagField = function (item) {
                            if ($scope.UIOptions.tagField) {
                                var v = item[$scope.UIOptions.tagField];
                                if (v) {
                                    return v;
                                }
                            }
                            return "none";
                        };

                        $scope.isNoImage = function (item) {
                            return !$scope.getImageUrl(item);
                        };

                        $scope.getImageUrl = function (item) {
                            if (!$scope.UIOptions.imageField) return null;

                            return esResolveBlobUrl(
                                item[$scope.UIOptions.imageField],
                                esWebApiService
                            );
                        };

                        $scope.getFieldText = function (item, col) {
                            var fieldName = col.field;
                            if (!item[fieldName]) return null;

                            if (esGlobals.isEmail(fieldName))
                                return (
                                    '<a href="mailto:' +
                                    item[fieldName] +
                                    '">' +
                                    item[fieldName] +
                                    "</a>"
                                );
                            else if (esGlobals.isPhone(fieldName))
                                return (
                                    '<a href="tel:' +
                                    item[fieldName] +
                                    '">' +
                                    item[fieldName] +
                                    "</a>"
                                );
                            else
                                return col.format
                                    ? kendo.format(col.format, item[fieldName])
                                    : item[fieldName];
                        };

                        $scope.getFieldStyle = function (item, col) {
                            var fVal = item[col.field];
                            return fVal && fVal < 0 ? { color: "red" } : null;
                        };

                        $scope.hasMap = function (item) {
                            return item.Latitude && item.Longitude;
                        };

                        $scope.showMap = function (item) {
                            if (!$scope.hasMap(item)) return;

                            var modalInstance = $uibModal.open({
                                animation: true,
                                ariaLabelledBy: "modal-title",
                                ariaDescribedBy: "modal-body",
                                template:
                                    "<div ng-include src=\"'src/partials/esmodalmap.html'\"></div>",
                                size: "lg",
                                controller: function () {
                                    var $ctrl = this;
                                    $ctrl.point = [
                                        item.Latitude,
                                        item.Longitude,
                                    ];
                                    $ctrl.title =
                                        ($scope.UIOptions.headerField
                                            ? item[$scope.UIOptions.headerField]
                                            : "") +
                                            " - " +
                                            ($scope.UIOptions.titleField
                                                ? item[
                                                      $scope.UIOptions
                                                          .titleField
                                                  ]
                                                : "") || item[0];
                                },
                                controllerAs: "$ctrl",
                            });

                            modalInstance.result
                                .then(function (selectedItem) {})
                                .catch(angular.noop);
                        };

                        if (
                            $scope.esPqDef &&
                            $scope.esPqDef.PQOptions &&
                            $scope.esPqDef.PQOptions.AutoExecute
                        ) {
                            $scope.executePQ();
                        }
                    },
                };
            },
        ])

        .directive("esMetricPq", [
            "$log",
            "$window",
            "$uibModal",
            "$timeout",
            "esWebApi",
            "esMessaging",
            "esUIHelper",
            "esGlobals",
            function (
                $log,
                $window,
                $uibModal,
                $timeout,
                esWebApiService,
                esMessaging,
                esWebUIHelper,
                esGlobals
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esPqDef: "=",
                    },
                    templateUrl: function (element, attrs) {
                        return "src/partials/esMetricPQ.html";
                    },
                    link: function ($scope, iElement, iAttrs) {
                        $scope.executePQ = function () {
                            $scope.esPqDef.esPanelOpen.status = false;
                            $scope.metricDataSource.page(1);
                        };

                        $scope.esPqDef.runPQ = $scope.executePQ;

                        var options = {
                            titleField: "",
                            valueField: "",
                            tagField: "",
                            iconField: "",
                        };

                        var scr = $scope.esPqDef.UIOptions;
                        if (scr) {
                            angular.merge(options, scr);
                        }

                        $scope.UIOptions = options;

                        var dsOptions = {
                            serverGrouping: false,
                            serverSorting: false,
                            serverFiltering: false,
                            serverAggregates: false,
                            serverPaging: true,
                            pageSize: 100,
                        };
                        $scope.metricDataSource = esWebUIHelper.getPQDataSource(
                            $scope.esPqDef,
                            dsOptions
                        );

                        $scope.getValue = function (row) {
                            var v = row[$scope.UIOptions.valueField];

                            if ($scope.UIOptions.formatValue) {
                                return kendo.format(
                                    $scope.UIOptions.formatValue,
                                    v
                                );
                            } else {
                                return v;
                            }
                        };

                        $scope.getTagField = function (item) {
                            if ($scope.UIOptions.tagField) {
                                var v = item[$scope.UIOptions.tagField];
                                if (v) {
                                    return v;
                                }
                            }
                            return "none";
                        };

                        if (
                            $scope.esPqDef &&
                            $scope.esPqDef.PQOptions &&
                            $scope.esPqDef.PQOptions.AutoExecute
                        ) {
                            $scope.executePQ();
                        }
                    },
                };
            },
        ])

        .directive("esTreeMap", [
            "$log",
            "$window",
            "esWebApi",
            "esMessaging",
            "esUIHelper",
            "esGlobals",
            function (
                $log,
                $window,
                esWebApiService,
                esMessaging,
                esWebUIHelper,
                esGlobals
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esPanelOpen: "=?",
                        esPqDef: "=?",
                        esChartCtrl: "=?",
                        esChartOptions: "=?",
                    },
                    templateUrl: function (element, attrs) {
                        return "src/partials/esTreeMapPQ.html";
                    },
                    link: function ($scope, iElement, iAttrs) {
                        var ctrlF = function () {
                            return $scope.esTreeMapCtrl;
                        };

                        var onResize = function () {
                            var ctrl = ctrlF();

                            if (ctrl) {
                                ctrl.resize();
                            } else {
                                kendo.resize(
                                    angular.element(".eschart-wrapper")
                                );
                            }
                        };

                        $scope.esChartDataSource = esWebUIHelper.getTreeMapDS(
                            $scope.esPqDef,
                            false,
                            null,
                            ctrlF
                        );

                        var tOptions = $scope.esChartOptions || {};

                        tOptions.valueField = "value";
                        tOptions.textField = "name";

                        $scope.executePQ = function () {
                            $scope.esPqDef.esPanelOpen.status = false;
                            if ($scope.esChartDataSource) {
                                $scope.esChartDataSource.read();
                            }
                        };

                        $scope.esPqDef.runPQ = $scope.executePQ;

                        $scope.$on("$destroy", function () {
                            angular.element($window).unbind("resize", onResize);
                        });

                        angular.element($window).bind("resize", onResize);

                        tOptions.dataSource = $scope.esChartDataSource;
                    },
                };
            },
        ])

        .directive("esPivotPq", [
            "$log",
            "$window",
            "$q",
            "esWebApi",
            "esMessaging",
            "esUIHelper",
            "esGlobals",
            "esCache",
            function (
                $log,
                $window,
                $q,
                esWebApiService,
                esMessaging,
                esWebUIHelper,
                esGlobals,
                esCache
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esPqDef: "=",
                        esPanelOpen: "=?",
                    },
                    templateUrl: function (element, attrs) {
                        return "src/partials/esPivotPQ.html";
                    },
                    link: {
                        pre: function ($scope, iElement, iAttrs) {
                            var bBound = false;
                            var setts = esGlobals.getESUISettings();

                            if (
                                !$scope.esPqDef ||
                                !$scope.esPqDef.UIOptions ||
                                !$scope.esPqDef.UIOptions.cubeDef
                            ) {
                                throw "espivotpq directive is either missing esPqDef or esPqDef.UIOptions or esPqDef.UIOptions.cubeDef";
                            }
                            var defOptions = {
                                allowSortingBySummary: true,
                                allowSorting: true,
                                allowFiltering: true,
                                allowExpandAll: true,
                                showBorders: true,
                                rowHeaderLayout: "tree",
                                fieldChooser: {
                                    enabled: true,
                                },
                                export: {
                                    enabled: true,
                                },

                                fieldPanel: {
                                    showDataFields: true,
                                    showRowFields: true,
                                    showColumnFields: true,
                                    showFilterFields: true,
                                    allowFieldDragging: true,
                                    visible: false,
                                },
                            };

                            $scope.chartOptions = {
                                commonSeriesSettings: {
                                    type: "bar",
                                },
                                tooltip: {
                                    enabled: true,
                                    customizeTooltip: function (args) {
                                        var x = esCache.getItem("ES_BASE_CURR");
                                        var valueText = "";
                                        if (x) {
                                            try {
                                                valueText =
                                                    Globalize.formatCurrency(
                                                        args.originalValue,
                                                        x
                                                    );
                                            } catch (err) {
                                                valueText = args.valueText;
                                            }
                                        } else {
                                            valueText = args.valueText;
                                        }

                                        return {
                                            html:
                                                args.seriesName +
                                                "<div class='currency'>" +
                                                valueText +
                                                "</div>",
                                        };
                                    },
                                },
                                onInitialized: function (e) {
                                    $scope.pivotChart = e.component;

                                    if (!bBound && $scope.gridInstance) {
                                        $scope.gridInstance.bindChart(
                                            $scope.pivotChart,
                                            {
                                                dataFieldsDisplayMode:
                                                    "splitPanes",
                                                alternateDataFields: false,
                                            }
                                        );
                                        bBound = true;
                                    }
                                },
                            };

                            var tOptions = defOptions;

                            if ($scope.esPqDef.UIOptions.pivotOptions) {
                                var x = angular.merge(
                                    {},
                                    tOptions,
                                    $scope.esPqDef.UIOptions.pivotOptions
                                );
                                angular.merge(tOptions, x);
                            }

                            tOptions.onContextMenuPreparing = function (e) {
                                var sourceField = e.field;
                                var dataSource = e.component.getDataSource();
                                if (sourceField) {
                                    if (sourceField.dataType === "number") {
                                        var setSummaryType = function (args) {
                                                dataSource.field(
                                                    sourceField.index,
                                                    {
                                                        summaryType:
                                                            args.itemData.value,
                                                    }
                                                );
                                                dataSource.load();
                                            },
                                            menuItems = [];

                                        e.items.splice(0, 0, {
                                            text: "Summary Type",
                                            beginGroup: true,
                                            items: menuItems,
                                        });

                                        _.forEach(
                                            ["Sum", "Avg", "Min", "Max"],
                                            function (summaryType) {
                                                var summaryTypeValue =
                                                    summaryType.toLowerCase();
                                                menuItems.push({
                                                    text: summaryType,
                                                    value: summaryType.toLowerCase(),
                                                    onItemClick: setSummaryType,
                                                    selected:
                                                        e.field.summaryType ===
                                                        summaryTypeValue,
                                                });
                                            }
                                        );
                                    }
                                    return;
                                }

                                var l =
                                    $scope.gridInstance.option(
                                        "rowHeaderLayout"
                                    );
                                var nl = l == "standard" ? "tree" : "standard";
                                e.items.splice(0, 0, {
                                    beginGroup: true,
                                    text: "RowHeader Layout " + nl,
                                    onItemClick: function (c) {
                                        $scope.gridInstance.option(
                                            "rowHeaderLayout",
                                            nl
                                        );
                                    },
                                });

                                var l1 =
                                    $scope.gridInstance.option(
                                        "showTotalsPrior"
                                    );
                                var nl1 = l1 == "both" ? "none" : "both";
                                e.items.splice(1, 0, {
                                    beginGroup: true,
                                    text: "Show Totals " + nl1,
                                    onItemClick: function (c) {
                                        $scope.gridInstance.option(
                                            "showTotalsPrior",
                                            nl1
                                        );
                                    },
                                });

                                var l2 =
                                    $scope.gridInstance.option("dataFieldArea");
                                var nl2 = l2 == "row" ? "column" : "row";
                                e.items.splice(2, 0, {
                                    beginGroup: true,
                                    text: "Data Field headers in " + nl2,
                                    onItemClick: function (c) {
                                        $scope.gridInstance.option(
                                            "dataFieldArea",
                                            nl2
                                        );
                                    },
                                });

                                if ($scope.esPqDef.UIOptions.enableChart) {
                                    e.items.push({
                                        beginGroup: true,
                                        text: $scope.esPqDef.UIOptions.hideChart
                                            ? "Show Chart"
                                            : "Hide Chart",
                                        onItemClick: function (c) {
                                            $scope.esPqDef.UIOptions.hideChart =
                                                !$scope.esPqDef.UIOptions
                                                    .hideChart;
                                        },
                                    });
                                }
                            };

                            tOptions.onCellClick = function (e) {
                                if (e.area == "data") {
                                    var pivotGridDataSource =
                                        e.component.getDataSource();
                                    var popupTitle =
                                        e.cell.rowPath.join("/") +
                                        " - " +
                                        e.cell.columnPath.join("/") +
                                        " : " +
                                        e.dataFields[e.cell.dataIndex].caption;

                                    $scope.drillDownDataSource =
                                        pivotGridDataSource.createDrillDownDataSource(
                                            e.cell
                                        );
                                    $scope.salesPopupTitle = popupTitle;
                                    $scope.salesPopupVisible = true;
                                }
                            };

                            tOptions.onInitialized = function (e) {
                                $scope.gridInstance = e.component;

                                if ($scope.pivotChart && !bBound) {
                                    $scope.gridInstance.bindChart(
                                        $scope.pivotChart,
                                        {
                                            dataFieldsDisplayMode: "splitPanes",
                                            alternateDataFields: false,
                                        }
                                    );
                                    bBound = true;
                                }
                            };

                            var plt = DevExpress.devices.current();

                            if (plt.tablet || plt.phone) {
                                // force narrow settings for mobile
                                tOptions.rowHeaderLayout = "tree";
                            }
                            DevExpress.viz.currentTheme(plt, "light");

                            $scope.pivotOptions = tOptions;

                            esWebApiService
                                .fetchPublicQueryInfo(
                                    $scope.esPqDef,
                                    null,
                                    true,
                                    true
                                )
                                .then(function (ret) {
                                    var v =
                                        esWebUIHelper.winGridInfoToESGridInfo(
                                            $scope.esPqDef.GroupID,
                                            $scope.esPqDef.FilterID,
                                            ret.data
                                        );

                                    if (tOptions.export) {
                                        tOptions.export.fileName = v.caption;
                                        tOptions.export.proxyURL =
                                            esWebApiService.proxyExportSaveFile(
                                                "telerik"
                                            );
                                    }

                                    $scope.dataGridOptions = {
                                        columnAutoWidth: true,
                                        rowAlternationEnabled: true,
                                        filterRow: {
                                            visible: true,
                                            applyFilter: "auto",
                                        },
                                        height: "100%",
                                        paging: {
                                            enabled: true,
                                            pageSize: 20,
                                            pageIndex: 1,
                                        },
                                        bindingOptions: {
                                            dataSource: {
                                                dataPath: "drillDownDataSource",
                                                deep: false,
                                            },
                                        },
                                        columns: _.map(
                                            _.filter(v.columns, function (x) {
                                                return !x.hidden;
                                            }),
                                            function (o) {
                                                return {
                                                    dataField: o.field,
                                                    caption: o.title,
                                                    allowSorting: true,
                                                    allowFiltering: true,
                                                    format: getPivotColFormatType(
                                                        o
                                                    ),
                                                };
                                            }
                                        ),
                                    };

                                    $scope.popupOptions = {
                                        showCloseButton: true,

                                        bindingOptions: {
                                            title: "salesPopupTitle",
                                            visible: "salesPopupVisible",
                                        },
                                    };

                                    $scope.esPivotDataSource =
                                        esWebUIHelper.getPivotDS(
                                            $q,
                                            $scope.esPqDef,
                                            $scope.esPqDef.UIOptions.cubeDef,
                                            v
                                        );
                                    if (
                                        $scope.esPqDef.PQOptions &&
                                        $scope.esPqDef.PQOptions.AutoExecute
                                    ) {
                                        $scope.gridInstance.option(
                                            "dataSource",
                                            $scope.esPivotDataSource
                                        );
                                    }
                                })
                                .catch(function (err) {
                                    $log.error(err);
                                });

                            $scope.executePQ = function () {
                                $scope.esPqDef.esPanelOpen.status = false;
                                if (!$scope.gridInstance.option("dataSource")) {
                                    $scope.gridInstance.option(
                                        "dataSource",
                                        $scope.esPivotDataSource
                                    );
                                } else {
                                    $scope.esPivotDataSource.reload();
                                }
                            };

                            $scope.esPqDef.runPQ = $scope.executePQ;
                        },
                    },
                };
            },
        ])

        .directive("esMapPq", [
            "$log",
            "$window",
            "esWebApi",
            "esMessaging",
            "esUIHelper",
            "esGlobals",
            function (
                $log,
                $window,
                esWebApiService,
                esMessaging,
                esWebUIHelper,
                esGlobals
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esPanelOpen: "=?",
                        esPqDef: "=?",
                        esOptions: "=?",
                    },
                    templateUrl: function (element, attrs) {
                        return "src/partials/esMapPQ.html";
                    },
                    link: function ($scope, iElement, iAttrs) {
                        var onChange = function (e) {
                            var map = $scope.esMapCtrl;
                            if (!map) {
                                return;
                            }

                            if (!e.items || !e.items.length) {
                                map.center([
                                    32.546813173515126, -4.218749999999986,
                                ]);
                                map.zoom(2);
                            }

                            var extent;
                            for (var i = 0; i < e.items.length; i++) {
                                var loc = [
                                    e.items[i].Latitude || e.items[i].latitude,
                                    e.items[i].Longitude ||
                                        e.items[i].longitude,
                                ];

                                if (!extent) {
                                    extent = new kendo.dataviz.map.Extent(
                                        loc,
                                        loc
                                    );
                                } else {
                                    extent.include(loc);
                                }
                            }

                            map.extent(extent);
                        };

                        var ctrlF = function () {
                            return $scope.esMapCtrl;
                        };

                        var onResize = function () {
                            var ctrl = ctrlF();

                            if (ctrl) {
                                ctrl.resize();
                            } else {
                                kendo.resize(
                                    angular.element(".eschart-wrapper")
                                );
                            }
                        };

                        $scope.bubbleMessage = "";
                        $scope.tlOptions = {
                            filter: "circle",
                            content: function () {
                                return $scope.bubbleMessage;
                            },
                            position: "top",
                            animation: {
                                open: {
                                    effects: "zoom",
                                    duration: 150,
                                },
                            },
                        };

                        var esOptions = $scope.esOptions || {};
                        var valField =
                            esOptions.valueField &&
                            angular.isString(esOptions.valueField)
                                ? esOptions.valueField
                                : "Figure";

                        $scope.esMapDataSource = esWebUIHelper.getTreeMapDS(
                            $scope.esPqDef,
                            true,
                            onChange,
                            ctrlF,
                            valField
                        );
                        $scope.esMapOptions = {};
                        var tOptions = $scope.esMapOptions;

                        var dataLayer = {
                            type:
                                esOptions.type &&
                                angular.isString(esOptions.type)
                                    ? esOptions.type
                                    : "marker",
                            dataSource: $scope.esMapDataSource,
                            locationField: "latlng",
                            titleField:
                                esOptions.titleField &&
                                angular.isString(esOptions.titleField)
                                    ? esOptions.titleField
                                    : "esLabel",
                            autoBind: angular.isUndefined(esOptions.autoBind)
                                ? false
                                : !!esOptions.autoBind,
                            valueField: valField,
                        };

                        if (dataLayer.type == "bubble") {
                            tOptions.shapeMouseEnter = function (e) {
                                $scope.bubbleMessage =
                                    e.shape.dataItem[dataLayer.titleField] +
                                    " - " +
                                    e.shape.dataItem[
                                        dataLayer.valueField
                                    ].toString();
                                e.shape.options.set("stroke", {
                                    width: 2,
                                    color: "#00f",
                                });

                                $scope.$apply();
                            };
                            tOptions.shapeMouseLeave = function (e) {
                                $scope.bubbleMessage = "";
                                e.shape.options.set("stroke", null);
                                $scope.$apply();
                            };

                            dataLayer.style = {
                                fill: {
                                    color:
                                        esOptions.color &&
                                        angular.isString(esOptions.color)
                                            ? esOptions.color
                                            : "#00F",
                                },
                                stroke: {
                                    width: 1,
                                },
                            };
                        }

                        tOptions.layers = [
                            {
                                type: "tile",
                                urlTemplate:
                                    "https://#= subdomain #.tile.openstreetmap.org/#= zoom #/#= x #/#= y #.png",
                                subdomains: ["a", "b", "c"],
                                attribution:
                                    "&copy; <a href='http://osm.org/copyright'>OpenStreetMap contributors</a>." +
                                    "Tiles courtesy of <a href='http://www.openstreemap.org/'>Entersoft SA</a>",
                            },
                            dataLayer,
                        ];

                        $scope.executePQ = function () {
                            $scope.esPanelOpen.status = false;
                            if ($scope.esMapDataSource) {
                                $scope.esMapDataSource.read();
                            }
                        };

                        $scope.esPqDef.runPQ = $scope.executePQ;

                        $scope.$on("$destroy", function () {
                            angular.element($window).unbind("resize", onResize);
                        });

                        angular.element($window).bind("resize", onResize);
                    },
                };
            },
        ])

        .directive("esLocalGrid", [
            "$log",
            "esWebApi",
            "esMessaging",
            "esUIHelper",
            "esGlobals",
            function (
                $log,
                esWebApiService,
                esMessaging,
                esWebUIHelper,
                esGlobals
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esGridOptions: "=",
                        esDataSource: "=",
                    },
                    templateUrl: function (element, attrs) {
                        return "src/partials/esLocalGrid.html";
                    },
                    link: function ($scope, iElement, iAttrs) {
                        $scope.esGridRun = function () {
                            if ($scope.esGridCtrl) {
                                $scope.esGridCtrl.dataSource.read();
                            }
                        };
                    },
                };
            },
        ])

        /**
         * @ngdoc directive
         * @name es.Web.UI.directive:es00DocumentsDetail
         * @requires es.Services.Web.esWebApi Entersoft AngularJS WEB API for Entersoft Application Server
         * @requires es.Web.UI.esUIHelper
         * @requires $log
         * @restrict AE
         * @param {object=} esDocumentGridOptions A subset or full set of esGridOptions for the kendo-grid that will show the ES00Documents.
         * The ES00Documents kendo-grid will be initialized by the merge of the PublicQueryInfo gridoptions as retrieved for the GroupID = "ES00Documents" and
         * FilterID = "ES00DocumentsDetails" public query.
         * @param {string=} esMasterRowField The field of the master grid row that the ES00DocumentGrid will be a detail of. The value of this field in the master row will form
         * the parameter for fetchES00DocumentsByGID service to retrieve the ES00DocumentRows.
         *
         * @description
         *
         * **TBD**
         * This directive is responsible to render the html for the presentation of the ES00Documents as a detail of a kendo-grid
         */
        .directive("es00DocumentsDetail", [
            "$log",
            "$uibModal",
            "esWebApi",
            "esUIHelper",
            "esGlobals",
            "esCache",
            function (
                $log,
                $uibModal,
                esWebApiService,
                esWebUIHelper,
                esGlobals,
                esCache
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esDocumentGridOptions: "=?",
                        esMasterRowField: "=?",
                        esIsudgid: "=?",
                    },
                    template:
                        "<div ng-include src=\"'src/partials/es00DocumentsDetail.html'\"></div>",
                    link: function ($scope, iElement, iAttrs) {
                        $scope.$watch("esIsudgid", function (newVal, oldVal) {
                            if (
                                $scope.esDocumentGridOptions &&
                                $scope.esDocumentGridOptions.dataSource
                            ) {
                                $scope.esDocumentGridOptions.dataSource.read();
                            }
                        });

                        if (
                            !$scope.esIsudgid &&
                            !iAttrs.esIsudgid &&
                            !$scope.esMasterRowField &&
                            !iAttrs.esMasterRowField
                        ) {
                            $scope.esMasterRowField = "GID";
                            $log.warn(
                                "esIsudgid is not specified and esMasterRowField for es00DocumentsDetail directive NOT specified. Assuming GID"
                            );
                        }

                        var getOptions = function () {
                            var g = "ES00Documents";
                            var f = "ES00DocumentsDetails";
                            var xParam = {
                                serverGrouping: false,
                                serverSorting: false,
                                serverFiltering: false,
                                serverPaging: false,
                                pageSize: 20,
                                transport: {
                                    read: function (options) {
                                        try {
                                            var searchVal = $scope.esIsudgid
                                                ? $scope.esIsudgid
                                                : $scope.$parent.dataItem[
                                                      $scope.esMasterRowField
                                                  ];
                                            esWebApiService
                                                .fetchES00DocumentsByEntityGID(
                                                    searchVal
                                                )
                                                .then(function (ret) {
                                                    options.success(ret);
                                                })
                                                .catch(function (err) {
                                                    options.error(err);
                                                });
                                        } catch (x) {
                                            options.success({ data: [] });
                                        }
                                    },
                                },
                                schema: {
                                    data: "data",
                                    total: "data.length",
                                },
                            };

                            var xDS = new kendo.data.DataSource(xParam);

                            var pqinfo = esCache.getItem("PQI_" + g + "/" + f);
                            if (pqinfo) {
                                processPQInfo(pqinfo, xDS, g, f);
                            } else {
                                esWebApiService
                                    .fetchPublicQueryInfo(g, f, true, true)
                                    .then(function (ret) {
                                        esCache.setItem(
                                            "PQI_" + g + "/" + f,
                                            ret.data
                                        );
                                        processPQInfo(ret.data, xDS, g, f);
                                    })
                                    .catch(angular.noop);
                            }
                        };

                        function processPQInfo(ret, xDS, g, f) {
                            var p1 = ret;
                            var p2 = esWebUIHelper.winGridInfoToESGridInfo(
                                g,
                                f,
                                p1
                            );
                            var pqO = new esGlobals.ESPQOptions(
                                1,
                                -1,
                                true,
                                false
                            );
                            ret = esWebUIHelper.esGridInfoToKInfo(
                                g,
                                f,
                                {},
                                p2,
                                pqO
                            );
                            ret.autoBind = true;
                            ret.toolbar = null;
                            ret.groupable = false;
                            ret.dataSource = xDS;
                            // Add the download column
                            var codeColumn = _.find(p2.columns, {
                                field: "Code",
                            });
                            if (codeColumn) {
                                var sLink =
                                    esWebApiService.downloadURLForBlobDataDownload(
                                        "{{dataItem.GID}}"
                                    );
                                codeColumn.template =
                                    "<a ng-href='" +
                                    sLink +
                                    "' download>{{dataItem.Code}}</a>";
                            }

                            $scope.esDocumentGridOptions = angular.extend(
                                ret,
                                $scope.esDocumentGridOptions
                            );
                        }

                        getOptions();
                    },
                };
            },
        ])

        .controller("esModalInvestigateCtrl", [
            "$scope",
            "$uibModalInstance",
            "esMessaging",
            "invParams",
            function ($scope, $uibModalInstance, esMessaging, invParams) {
                $scope.investigateGridOptions = {
                    autoBind: true,
                    selectable: invParams.paramDef.multiValued
                        ? "multiple, row"
                        : "row",
                };
                $scope.invParams = invParams || {};
                $scope.selectedRows = null;

                var selFunc = function (evt, selectedRows) {
                    if (!selectedRows || selectedRows.length == 0) {
                        $scope.selectedRows = null;
                        return;
                    }

                    $scope.selectedRows = _.map(
                        selectedRows,
                        function (selItem) {
                            return evt.sender.dataItem(selItem)[$scope.invParams.esConnect];
                        }
                    );
                };

                $uibModalInstance.closed
                    .then(function () {
                        esMessaging.unsubscribe(hndl);
                    })
                    .catch(angular.noop);

                var hndl = esMessaging.subscribe("GRID_ROW_CHANGE", selFunc);

                $scope.ok = function () {
                    $uibModalInstance.close($scope.selectedRows);
                };

                $scope.cancel = function () {
                    $uibModalInstance.dismiss("cancel");
                };
            },
        ])

        .controller("esAdvancedParamCtrl", [
            "$uibModalInstance",
            "inAdvancedParam",
            function ($uibModalInstance, inAdvancedParam) {
                var $ctrl = this;
                $ctrl.editedParam = inAdvancedParam;

                $ctrl.ok = function () {
                    $uibModalInstance.close($ctrl.editedParam);
                };
            },
        ])

        .controller("esAskForFieldCtrl", [
            "$uibModalInstance",
            "inDef",
            function ($uibModalInstance, inDef) {
                var $ctrl = this;
                $ctrl.inDef = inDef;

                $ctrl.ok = function () {
                    $uibModalInstance.close(true);
                };

                $ctrl.cancel = function () {
                    $uibModalInstance.dismiss("cancel");
                };
            },
        ])

        .controller("esChangePasswordCtrl", [
            "$uibModalInstance",
            "inDef",
            function ($uibModalInstance, inDef) {
                var $ctrl = this;
                $ctrl.inDef = inDef;

                $ctrl.ok = function () {
                    $uibModalInstance.close($ctrl.inDef);
                };

                $ctrl.cancel = function () {
                    $uibModalInstance.dismiss("cancel");
                };
            },
        ])

        /**
         * @ngdoc directive
         * @name es.Web.UI.directive:esParam
         * @function
         *
         * @description
         * **TBD**
         *
         *
         */
        .directive("esParam", [
            "$log",
            "$uibModal",
            "esWebApi",
            "esUIHelper",
            "esGlobals",
            function (
                $log,
                $uibModal,
                esWebApiService,
                esWebUIHelper,
                esGlobals
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esParamDef: "=",
                        esParamVal: "=",
                        esType: "=",
                    },
                    template:
                        "<div ng-include src=\"'src/partials/'+esType+'.html'\"></div>",
                    link: function ($scope, iElement, iAttrs) {
                        if (!$scope.esParamDef) {
                            throw "You must set a param";
                        }

                        $scope.drStatus = {
                            dateOpen: false,
                        };

                        $scope.askForMore = function (modalType) {
                            if (!modalType) {
                            }

                            var tmpl =
                                "esAdvancedModal" +
                                modalType.toUpperCase() +
                                ".html";

                            var modalInstance = $uibModal.open({
                                animation: true,
                                ariaLabelledBy: "modal-title",
                                ariaDescribedBy: "modal-body",
                                template:
                                    "<div ng-include src=\"'src/partials/" +
                                    tmpl +
                                    "'\"></div>",
                                controller: "esAdvancedParamCtrl",
                                controllerAs: "$ctrl",
                                size: "sm",
                                appendTo: null,
                                resolve: {
                                    inAdvancedParam: function () {
                                        return {
                                            esParamDef: $scope.esParamDef,
                                            esParamVal: $scope.esParamVal,
                                            esGlobals: esGlobals,
                                        };
                                    },
                                },
                            });

                            modalInstance.result
                                .then(function (selectedItem) {})
                                .catch(angular.noop);
                        };

                        $scope.onClose = function (e, isComplex) {
                            if (e && e.sender) {
                                var v = e.sender.value();
                                if (!isComplex) {
                                    if (v != "0" && v != "1") {
                                        $scope.drStatus.dateOpen = false;
                                    }
                                } else {
                                    if (v == "NULL" || v == "NOTNULL") {
                                        $scope.drStatus.dateOpen = false;
                                    }
                                }
                            }
                        };

                        if ($scope.esParamDef.isInvestigateEntity()) {
                            $scope.onInvestigate = function () {
                                var modalInstance = $uibModal.open({
                                    animation: true,
                                    ariaLabelledBy: "modal-title",
                                    ariaDescribedBy: "modal-body",
                                    template:
                                        "<div ng-include src=\"'src/partials/esInvestigate.html'\"></div>",
                                    controller: "esModalInvestigateCtrl",
                                    size: "lg",
                                    resolve: {
                                        invParams: function () {
                                            var newP =
                                                $scope.esParamVal[
                                                    $scope.esParamDef.id
                                                ].clone("Code");
                                            var esGroup = "",
                                                esFilter = "",
                                                esConnect = "";
                                            var parts = $scope.esParamDef
                                                .getTag("INVPQ:")
                                                .split("INVPQ:");
                                            if (parts.length >= 2) {
                                                parts = parts[1].split("\\");
                                                if (parts.length >= 3) {
                                                    esGroup = parts[0];
                                                    esFilter = parts[1];
                                                    esConnect = parts[2];
                                                }
                                            }

                                            return {
                                                paramDef: $scope.esParamDef,
                                                esGroup: esGroup,
                                                esFilter: esFilter,
                                                esConnect: esConnect,
                                                pVals: new esGlobals.ESParamValues(
                                                    [newP]
                                                ),
                                            };
                                        },
                                    },
                                });

                                modalInstance.result
                                    .then(function (selectedRows) {
                                        if (
                                            !selectedRows ||
                                            selectedRows.length == 0
                                        ) {
                                            return;
                                        }
                                        var sVal = _.join(selectedRows, "\\,");
                                        $scope.esParamVal[
                                            $scope.esParamDef.id
                                        ].pValue(sVal);
                                    })
                                    .catch(angular.noop);
                            };
                        }

                        $scope.esGlobals = esGlobals;
                        $scope.esWebUIHelper = esWebUIHelper;
                        $scope.esWebApiService = esWebApiService;

                        if ($scope.esParamDef.isInvestigateZoom()) {
                            $scope.esParamLookupDS =
                                esWebUIHelper.getZoomDataSource(
                                    $scope.esParamDef.invSelectedMasterTable
                                );
                        }

                        // Case Date Range
                        if (
                            $scope.esParamDef.controlType == 6 ||
                            $scope.esParamDef.controlType == 20
                        ) {
                            $scope.dateRangeOptions =
                                esGlobals.getesDateRangeOptions(
                                    $scope.esParamDef.controlType
                                );
                        }
                    },
                };
            },
        ])
        /**
         * @ngdoc directive
         * @name es.Web.UI.directive:esWebPq
         * @element div
         * @function
         *
         * @description
         * **TBD**
         *
         *
         */
        .directive("esWebPq", [
            "$log",
            "esWebApi",
            "esUIHelper",
            "esMessaging",
            "esGlobals",
            "esCache",
            function (
                $log,
                esWebApiService,
                esWebUIHelper,
                esMessaging,
                esGlobals,
                esCache
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esGroupId: "=",
                        esFilterId: "=",
                        esGridOptions: "=?",
                        esForceTitle: "=?",
                        esParamsValues: "=",
                        esPanelOpen: "=?",
                        esPqDef: "=?",
                        esPQOptions: "=?",
                        esShowTopPagination: "=",
                        esPostProcessGridOptions: "&",
                    },
                    templateUrl: function (element, attrs) {
                        return "src/partials/esWebPQ.html";
                    },
                    link: function ($scope, iElement, iAttrs) {
                        function donePreparation() {
                            if (
                                $scope.esPqDef &&
                                $scope.esPqDef.isDonePromise
                            ) {
                                $scope.esPqDef.isDonePromise.resolve(
                                    $scope.esPqDef
                                );
                            }
                        }

                        function processPQInfo(retData) {
                            var v = esWebUIHelper.winGridInfoToESGridInfo(
                                $scope.esGroupId,
                                $scope.esFilterId,
                                retData
                            );
                            if (
                                $scope.esParamsValues &&
                                $scope.esParamsValues instanceof
                                    esGlobals.ESParamValues
                            ) {
                                $scope.esParamsValues.merge(v.defaultValues);
                            } else {
                                $scope.esParamsValues = v.defaultValues;
                            }
                            $scope.esParamsDef = v.params;

                            var p = esWebUIHelper.esGridInfoToKInfo(
                                $scope.esGroupId,
                                $scope.esFilterId,
                                $scope.esParamsValues,
                                v,
                                $scope.esPQOptions,
                                $scope.esPqDef
                            );
                            var opt = angular.extend(p, $scope.esGridOptions);

                            if (
                                $scope.esPostProcessGridOptions &&
                                angular.isFunction(
                                    $scope.esPostProcessGridOptions
                                )
                            ) {
                                opt =
                                    $scope.esPostProcessGridOptions({
                                        arg1: opt,
                                    }) || opt;
                            }

                            if (
                                opt &&
                                opt.esToolbars &&
                                angular.isArray(opt.esToolbars)
                            ) {
                                var existingtbs = opt.toolbar || [];

                                _.forEach(opt.esToolbars, function (newtb) {
                                    existingtbs.push({
                                        template: newtb.template,
                                    });
                                });
                            }

                            $scope.esGridOptions = opt;
                            donePreparation();
                        }

                        if (!$scope.esGroupId || !$scope.esFilterId) {
                            throw "You must set the pair es-group-id and es-filter-id attrs";
                        }

                        $scope.executePQ = function () {
                            $scope.esPanelOpen.status = false;
                            $scope.esGridOptions.dataSource.read();
                        };

                        if ($scope.esPqDef) {
                            $scope.esPqDef.runPQ = $scope.executePQ;
                            $scope.esPqDef.ParametersDefinition = function () {
                                return $scope.esParamsDef;
                            };
                        }

                        var pqinfo = esCache.getItem(
                            "PQI_" + $scope.esGroupId + "/" + $scope.esFilterId
                        );
                        if (pqinfo) {
                            processPQInfo(pqinfo);
                        } else {
                            esWebApiService
                                .fetchPublicQueryInfo(
                                    $scope.esGroupId,
                                    $scope.esFilterId,
                                    true,
                                    true
                                )
                                .then(function (ret) {
                                    esCache.setItem(
                                        "PQI_" +
                                            $scope.esGroupId +
                                            "/" +
                                            $scope.esFilterId,
                                        ret.data
                                    );
                                    processPQInfo(ret.data);
                                })
                                .catch(angular.noop);
                        }
                    },
                };
            },
        ])
        /**
         * @ngdoc directive
         * @name es.Web.UI.directive:esParamsPanel
         * @function
         *
         * @description
         * **TBD**
         *
         *
         */
        .directive("esParamsPanel", [
            "$translate",
            "$log",
            "esWebApi",
            "esUIHelper",
            "esGlobals",
            function (
                $translate,
                $log,
                esWebApiService,
                esWebUIHelper,
                esGlobals
            ) {
                return {
                    restrict: "AE",
                    scope: {
                        esPanelOpen: "=?",
                        esParamsDef: "=?",
                        esPqInfo: "=?",
                        esParamsValues: "=?",
                        esGroupId: "=?",
                        esFilterId: "=?",
                        esRunClick: "&",
                        esForceTitle: "=?",
                        esRunTitle: "@?",
                        esShowRun: "=?",
                        esLocalDataSource: "=?",
                        esDataSource: "=?",
                    },
                    templateUrl: function (element, attrs) {
                        return "src/partials/esParams.html";
                    },
                    link: function ($scope, iElement, iAttrs) {
                        $scope.esMore = false;

                        $scope.esToggleMore = function () {
                            $scope.esMore = !$scope.esMore;
                        };

                        var donePreparation = function () {
                            if (
                                $scope.esGroupId instanceof
                                    esGlobals.ESPublicQueryDef &&
                                $scope.esGroupId.isDonePromise
                            ) {
                                $scope.esGroupId.isDonePromise.resolve(
                                    $scope.esGroupId
                                );
                            }
                        };

                        if (!$scope.esPanelOpen) {
                            $scope.esPanelOpen = { status: false };
                        }

                        if (!iAttrs.esParamsDef && !iAttrs.esPqInfo) {
                            if (
                                !(
                                    $scope.esGroupId instanceof
                                    esGlobals.ESPublicQueryDef
                                )
                            ) {
                                if (!$scope.esGroupId || !$scope.esFilterId) {
                                    throw new Error(
                                        "You must set either the es-params-def or es-pq-info or the pair es-group-id and es-filter-id attrs"
                                    );
                                }
                            }
                        }

                        if ($scope.esShowRun && !$scope.esRunTitle) {
                            $translate("ESUI.PQ.PARAMS_PANEL_RUN")
                                .then(function (trans) {
                                    $scope.esRunTitle = trans;
                                })
                                .catch(angular.noop);
                        }

                        if (
                            $scope.esGroupId instanceof
                                esGlobals.ESPublicQueryDef &&
                            !iAttrs.esParamsValues
                        ) {
                            $scope.esParamsValues = $scope.esGroupId.Params;
                            $scope.esGroupId.ParametersDefinition =
                                function () {
                                    return $scope.esParamsDef;
                                };
                        }

                        if (!iAttrs.esParamsDef) {
                            if (!iAttrs.esPqInfo) {
                                // we are given groupid and filterid =>
                                // we must retrieve pqinfo on owr own
                                esWebApiService
                                    .fetchPublicQueryInfo(
                                        $scope.esGroupId,
                                        $scope.esFilterId,
                                        true,
                                        true
                                    )
                                    .then(function (ret) {
                                        var v =
                                            esWebUIHelper.winGridInfoToESGridInfo(
                                                $scope.esGroupId,
                                                $scope.esFilterId,
                                                ret.data
                                            );

                                        if (
                                            $scope.esGroupId instanceof
                                            esGlobals.ESPublicQueryDef
                                        ) {
                                            if ($scope.esLocalDataSource) {
                                                $scope.esGroupId.esGridOptions =
                                                    esWebUIHelper.esGridInfoToLocalKInfo(
                                                        $scope.esGroupId
                                                            .GroupID,
                                                        $scope.esGroupId
                                                            .FilterID,
                                                        $scope.esGroupId.Params,
                                                        v,
                                                        $scope.esDataSource,
                                                        $scope.esGroupId
                                                    );
                                            } else {
                                                var pOpt =
                                                    new esGlobals.ESPQOptions(
                                                        1,
                                                        -1,
                                                        true,
                                                        false
                                                    );
                                                $scope.esGroupId.esGridOptions =
                                                    esWebUIHelper.esGridInfoToKInfo(
                                                        $scope.esGroupId
                                                            .GroupID,
                                                        $scope.esGroupId
                                                            .FilterID,
                                                        $scope.esGroupId.Params,
                                                        v,
                                                        pOpt,
                                                        $scope.esGroupId
                                                    );
                                            }
                                        }

                                        if (
                                            $scope.esParamsValues &&
                                            $scope.esParamsValues instanceof
                                                esGlobals.ESParamValues
                                        ) {
                                            $scope.esParamsValues.merge(
                                                v.defaultValues
                                            );
                                        } else {
                                            $scope.esParamsValues =
                                                v.defaultValues;
                                        }
                                        $scope.esParamsDef = v.params;

                                        donePreparation();
                                    })
                                    .catch(angular.noop);
                            } else {
                                $scope.esParamsDef = esPqInfo.params;
                                donePreparation();
                            }
                        } else {
                            donePreparation();
                        }
                    },
                };
            },
        ]);

    /**
     * @ngdoc service
     * @name es.Web.UI.esUIHelper
     * @requires es.Services.Web.esWebApi Entersoft AngularJS WEB API for Entersoft Application Server
     * @requires $log
     * @description This service provides a set of javascript objects and functions to support UI oriented operations such as preparation
     * of schema model for a web grid to show the results of a PQ, Entersoft PQ Parameters meta-data manipulation , etc.
     * yh
     */
    esWEBUI.factory("esUIHelper", [
        "$state",
        "$translate",
        "$log",
        "$timeout",
        "esMessaging",
        "esWebApi",
        "esGlobals",
        function (
            $state,
            $translate,
            $log,
            $timeout,
            esMessaging,
            esWebApiService,
            esGlobals
        ) {
            function esColToKCol(esCol, showFormInfo, esGridInfo) {
                var tCol = {
                    field: esCol.field,
                    title: esCol.title,
                    width: esCol.width,
                    attributes: esCol.attributes,
                    columnSet: esCol.columnSet,
                    values: esCol.enumValues,
                    dataType: esCol.dataType,
                    hidden: !esCol.visible,
                    headerAttributes: {
                        class: "es-table-header-cell",
                    },
                    menu: !!esCol.title,
                    template: undefined,
                    footerTemplate: undefined,
                    aggregate: undefined,
                    groupFooterTemplate: undefined,
                };

                if (!esGridInfo || esGridInfo.totalRow) {
                    tCol.aggregate = esCol.aggregate;
                }

                switch (esCol.dataType) {
                    case "int32":
                    case "byte": {
                        if (esCol.editType == "8") {
                            tCol.template = kendo.format(
                                '<div align="center"><input type="checkbox" #={0} ? "checked=checked" : "" # disabled="disabled" ></input></div>',
                                esCol.field
                            );
                        }
                        break;
                    }
                    case "byte[]": {
                        if (esCol.editType == "0") {
                            tCol.template =
                                "<img src='" +
                                "#:kendo.format('data:image/jpg;base64,{0}', " +
                                esCol.field +
                                ")#" +
                                "'/>";
                        }
                        break;
                    }

                    case "string": {
                        //Check about ui-router state FIRST
                        var bShowForm = false;
                        if (
                            showFormInfo &&
                            showFormInfo.showCol == esCol.field &&
                            showFormInfo.selectedMasterField &&
                            showFormInfo.selectedState &&
                            $state
                        ) {
                            var sts = $state.get();
                            var sState = _.find(sts, {
                                name: showFormInfo.selectedState,
                            });
                            if (sState) {
                                var cond = kendo.format(
                                    "#= ((data.{0}) && (data.{1})) ? ",
                                    showFormInfo.selectedMasterField,
                                    esCol.field
                                );
                                var urllink =
                                    'kendo.format("<a ui-sref=\\"{2}({PK: \'{0}\'} )\\">{1}</a>", ' +
                                    showFormInfo.selectedMasterField +
                                    ", " +
                                    esCol.field +
                                    ", " +
                                    "'" +
                                    showFormInfo.selectedState +
                                    "'" +
                                    ")";

                                tCol.template =
                                    cond +
                                    urllink +
                                    kendo.format(
                                        " : (data.{0}) #",
                                        esCol.field
                                    );
                                bShowForm = true;
                            } else {
                                if (
                                    showFormInfo.selectedState &&
                                    showFormInfo.selectedState.toLowerCase() ==
                                        "es00documents"
                                ) {
                                    var sLink =
                                        esWebApiService.downloadURLForBlobDataDownload(
                                            "{{dataItem.GID}}"
                                        );
                                    tCol.template =
                                        "<a ng-href='" +
                                        sLink +
                                        "' download>{{dataItem.Code}}</a>";
                                }
                            }
                        }

                        if (!bShowForm) {
                            var ul = "";
                            if (
                                esCol.field.toLowerCase().indexOf("email") != -1
                            ) {
                                ul = "mailto:";
                            } else if (
                                esCol.field.toLowerCase().indexOf("tele") !=
                                    -1 ||
                                esCol.field.toLowerCase().indexOf("mobile") !=
                                    -1
                            ) {
                                ul = "tel:";
                            } else if (
                                esCol.field.toLowerCase().indexOf("website") !=
                                -1
                            ) {
                                tCol.template = kendo.format(
                                    "<a target='_blank' href='#={0}||''#'>#={0}||''#</a>",
                                    esCol.field
                                );
                            } 
                            else if (
                                esCol.field.toLowerCase().indexOf("download") !=
                                -1
                            ) {
                                tCol.template = kendo.format(
                                    "<a download='download' href='#={0}||''#'>Download</a>",
                                    esCol.field
                                );
                            }                           
                            else if (esCol.field.toLowerCase().indexOf("checkbox") != -1) {   
                                tCol.template = kendo.format(
                                    "<div align='center' class='checkbox-container'>" +
                                    "<input type='checkbox' ng-model='dataItem.isChecked' ng-change='updateCheckedItems(dataItem)' data-item-id='#={0}#' />" +
                                    "</div>",
                                    esCol.field
                                );
                            }
                            else if (
                                esCol.field
                                    .toLowerCase()
                                    .indexOf("eswebimage") != -1
                            ) {
                                tCol.template = kendo.format(
                                    "<a target='_blank' href='#={0}#.jpeg'><img src='#={0}#.jpeg' height='{1}' width='{1}'></a>",
                                    esCol.field,
                                    esCol.width
                                );
                            }

                            if (ul) {
                                tCol.template = kendo.format(
                                    "<a target='_blank' href='{1}#={0}||''#'>#={0}||''#</a>",
                                    esCol.field,
                                    ul
                                );
                            }
                        }
                        break;
                    }
                    case "datetime": {
                        var fStr = esCol.formatString || "d";
                        tCol.format = "{0:" + fStr + "}";
                        break;
                    }
                    default: {
                        if (esCol.formatString && esCol.formatString != "") {
                            tCol.format = "{0:" + esCol.formatString + "}";
                        }
                        break;
                    }
                }

                if (tCol.aggregate) {
                    tCol.aggregates = [tCol.aggregate];
                    var fmtStr = esCol.formatString
                        ? "kendo.toString(" +
                          tCol.aggregate +
                          ",'" +
                          esCol.formatString.replace(/#/g, "\\\\#") +
                          "') || ''"
                        : tCol.aggregate;
                    tCol.footerTemplate =
                        "<div style='text-align: right'>#:" +
                        fmtStr +
                        "#</div>";
                    tCol.groupFooterTemplate = tCol.footerTemplate;
                }
                return tCol;
            }

            function handleChangeGridRow(e) {
                var selectedRows = this.select();
                var gid = undefined;
                if (selectedRows && selectedRows.length == 1) {
                    //sme mas-det
                    gid = this.dataItem(selectedRows[0])["GID"];
                }

                if (gid && this.options.masterDetailRelations) {
                    if (
                        !(
                            this.options.masterDetailRelations instanceof
                            ESRequeryDetailGrids
                        )
                    ) {
                        throw "masterDetailRelations should be of type ESRequeryDetailGrids";
                    }

                    _.each(
                        this.options.masterDetailRelations.registeredRelations,
                        function (elem) {
                            if (elem instanceof ESMasterDetailGridRelation) {
                                $timeout(function () {
                                    var params = elem.detailParams();
                                    var ds = elem.detailDataSource();
                                    if (
                                        ds &&
                                        params &&
                                        params[elem.detailParamCode]
                                    ) {
                                        if (
                                            params[elem.detailParamCode].pValue(
                                                gid
                                            )
                                        ) {
                                            ds.read();
                                        }
                                    }
                                });
                            }
                        }
                    );
                }
                esMessaging.publish("GRID_ROW_CHANGE", e, selectedRows);
            }

            function prepareStdZoom(zoomID, useCache) {
                var xParam = {
                    transport: {
                        read: function (options) {
                            var pqOptions = {};
                            esWebApiService
                                .fetchStdZoom(zoomID, pqOptions, useCache)
                                .then(
                                    function (ret) {
                                        var pq = ret.data;

                                        // SME CHANGE THIS ONCE WE HAVE CORRECT PQ
                                        if (pq.Count == -1) {
                                            pq.Count = pq.Rows
                                                ? pq.Rows.length
                                                : 0;
                                        }
                                        // END tackling

                                        options.success(pq);
                                    },
                                    function (err) {
                                        options.error(err);
                                    }
                                )
                                .catch(angular.noop);
                        },
                    },
                    schema: {
                        data: "Rows",
                        total: "Count",
                    },
                };
                return new kendo.data.DataSource(xParam);
            }

            function processPQ(data) {
                function getItems(arr, maxLevel, curLevel) {
                    var i1 = [];

                    var propName = "a" + curLevel.toString();
                    _.forOwn(
                        _.groupBy(arr, function (x) {
                            return x[propName];
                        }),
                        function (value, key) {
                            if (key == "undefined") {
                                return i1;
                            }

                            var t = {};
                            t.name = key;
                            t.value = _.sumBy(value, function (o) {
                                return o.Figure;
                            });
                            if (curLevel < maxLevel) {
                                t.items = getItems(
                                    value,
                                    maxLevel,
                                    curLevel + 1
                                );
                            }

                            i1.push(t);
                        }
                    );
                    return i1;
                }

                function getMaxLevel(data) {
                    var i;
                    var dLen = data.length;
                    for (i = 10; i >= 1; i--) {
                        var propName = "a" + i.toString();
                        var ret = _.groupBy(data, function (x) {
                            return x[propName];
                        });
                        var noName = ret["undefined"];
                        if (
                            !(angular.isArray(noName) && noName.length == dLen)
                        ) {
                            return i;
                        }
                    }
                    return 0;
                }

                var ret = {
                    name: "All",
                    value: 0,
                };

                if (!data || !angular.isArray(data) || !data.length) {
                    return [ret];
                }

                var maxLevel = getMaxLevel(data);
                if (maxLevel == 0) {
                    return [ret];
                }

                ret.value =
                    _.sumBy(data, function (o) {
                        return o.Figure;
                    }) || 0;

                ret.items = getItems(data, maxLevel, 1);
                return [ret];
            }

            function getTreeMapDS(
                espqParams,
                forMap,
                onChange,
                ctrl,
                valueField
            ) {
                var transformFunction = forMap
                    ? convertPQRowsToMapRows
                    : processPQ;
                var qParams = angular.isFunction(espqParams)
                    ? espqParams()
                    : espqParams;

                var xParam = {
                    transport: {
                        read: function (options) {
                            var pqOptions = {};
                            pqOptions.WithCount = false;
                            pqOptions.Page = -1;
                            pqOptions.PageSize = -1;

                            var executeParams = qParams.Params;
                            if (
                                executeParams instanceof esGlobals.ESParamValues
                            ) {
                                if (!executeParams.isValidState()) {
                                    var err = new Error(
                                        $translate.instant(
                                            "ESUI.PQ.PARAMS_MISSING"
                                        )
                                    );
                                    options.error(err);
                                    throw err;
                                }
                                executeParams = executeParams.getExecuteVals();
                            }

                            esWebApiService
                                .fetchPublicQuery(
                                    qParams.GroupID,
                                    qParams.FilterID,
                                    pqOptions,
                                    executeParams
                                )
                                .then(function (pq) {
                                    pq = pq.data;

                                    pq.Rows = pq.Rows || [];
                                    var data = transformFunction(
                                        pq.Rows,
                                        valueField
                                    );
                                    options.success(data);
                                })
                                .catch(function (err) {
                                    options.error(err);
                                });
                        },
                    },
                    schema: {
                        model: {
                            children: "items",
                        },
                    },
                };

                if (onChange && angular.isFunction(onChange)) {
                    xParam.change = onChange;
                }

                if (ctrl && angular.isFunction(ctrl)) {
                    xParam.requestEnd = function (x) {
                        var elm = ctrl();
                        if (elm && elm.element && elm.element.parent()) {
                            kendo.ui.progress(elm.element.parent(), false);
                        }
                    };

                    xParam.requestStart = function (x) {
                        var elm = ctrl();
                        if (elm && elm.element && elm.element.parent()) {
                            kendo.ui.progress(elm.element.parent(), true);
                        }
                    };
                }

                return forMap
                    ? new kendo.data.DataSource(xParam)
                    : new kendo.data.HierarchicalDataSource(xParam);
            }

            function prepareWebScroller(
                espqParams,
                esOptions,
                aggregates,
                groups,
                ctrl
            ) {
                var qParams = angular.isFunction(espqParams)
                    ? espqParams()
                    : espqParams;

                if (groups && aggregates) {
                    _.map(groups, function (g) {
                        g.aggregates = aggregates;
                    });
                }

                var xParam = {
                    aggregate: aggregates,
                    group: groups,

                    transport: {
                        error: function (e) {
                            console.log(e);
                        },

                        read: function (options) {
                            var pqOptions = {};
                            if (
                                options.data &&
                                options.data.page &&
                                options.data.pageSize
                            ) {
                                pqOptions.WithCount = true;
                                pqOptions.Page = options.data.page;
                                pqOptions.PageSize = options.data.pageSize;
                            }

                            var executeParams = qParams.Params;
                            if (
                                executeParams instanceof esGlobals.ESParamValues
                            ) {
                                if (!executeParams.isValidState()) {
                                    var err = new Error(
                                        $translate.instant(
                                            "ESUI.PQ.PARAMS_MISSING"
                                        )
                                    );
                                    options.error(err);
                                    throw err;
                                }
                                executeParams = executeParams.getExecuteVals();
                            }

                            esWebApiService
                                .fetchPublicQuery(
                                    qParams.GroupID,
                                    qParams.FilterID,
                                    pqOptions,
                                    executeParams
                                )
                                .then(function (pq) {
                                    pq = pq.data;
                                    if (!angular.isDefined(pq.Rows)) {
                                        pq.Rows = [];
                                        pq.Count = 0;
                                    }

                                    if (!angular.isDefined(pq.Count)) {
                                        pq.Count = -1;
                                    }

                                    options.success(pq);
                                })
                                .catch(function (err) {
                                    $log.error("Error in DataSource ", err);
                                    options.error(err);
                                });
                        },
                    },
                    schema: {
                        data: "Rows",
                        total: "Count",
                    },
                };

                if (ctrl && angular.isFunction(ctrl)) {
                    xParam.requestEnd = function (x) {
                        var elm = ctrl();
                        if (elm && elm.element && elm.element.parent()) {
                            kendo.ui.progress(elm.element.parent(), false);
                        }
                    };

                    xParam.requestStart = function (x) {
                        var elm = ctrl();
                        if (elm && elm.element && elm.element.parent()) {
                            kendo.ui.progress(elm.element.parent(), true);
                        }
                    };
                }

                if (
                    qParams &&
                    qParams.SchemaColumns &&
                    qParams.SchemaColumns.length
                ) {
                    xParam.schema.parse = function (response) {
                        _.each(response.Rows, function (elem) {
                            _.each(qParams.SchemaColumns, function (col) {
                                var fld = col.field;
                                if (
                                    elem[fld] &&
                                    typeof elem[fld] === "string"
                                ) {
                                    elem[fld] = kendo.parseDate(elem[fld]);
                                }
                            });
                        });
                        return response;
                    };
                }

                if (esOptions) {
                    angular.extend(xParam, esOptions);
                }

                return new kendo.data.DataSource(xParam);
            }

            function getPivotDS($q, espqdef, escubedef, pqinfo) {
                function getPivotType(colType) {
                    switch (colType) {
                        case "string":
                            return "string";
                        case "decimal":
                            return "number";
                        case "datetime":
                        case "date":
                            return "date";
                        default:
                            return "string";
                    }
                }

                var t = escubedef || {};

                //First check which fields are in the PQ but no at the cubedef
                _.forEach(pqinfo.columns, function (x) {
                    var id = x.field.toLowerCase();
                    var idx = _.findIndex(t.fields, function (o) {
                        return o.dataField && (o.dataField.toLowerCase() == id);
                    });
                    if (idx == -1) {
                        t.fields.push({ dataField: x.field });
                    }
                });

                _.forEach(t.fields, function (x) {
                    if (!x.dataField) {
                        if (x.summaryType == "custom" && x.calculateCustomSummary)
                        {
                            var sParts = x.calculateCustomSummary.split(' ');
                            if (sParts[0] == "delta") {
                                x.calculateCustomSummary = function(options) {
                                    var Field = sParts[1];
                                    var PrevField = sParts[2];

                                    if (options.summaryProcess == 'start') {
                                        // Initializing "totalValue" here  
                                        options[Field] = 0;
                                        options[PrevField] = 0;
                                     }
                                     if (options.summaryProcess == 'calculate') {
                                        // Modifying "totalValue" here  
                                        options[Field] += options.value[Field];
                                        options[PrevField] += options.value[PrevField];
                                     }
                                     if (options.summaryProcess == 'finalize') {
                                        // Assigning the final value to "totalValue" here  
                                        var perc = (options[Field] - options[PrevField]) / options[PrevField] * 100;
                                        options.totalValue = perc.toFixed(1);
                                     }
                                }
                            }
                        }
                        return;
                    }

                    var id = x.dataField.toLowerCase();
                    var col = _.find(pqinfo.columns, function (y) {
                        return id == y.field.toLowerCase();
                    });

                    if (!col) {
                        return;
                    }

                    x.caption = x.caption || col.title;
                    //x.width = x.width || col.width;
                    x.dataType = x.dataType || getPivotType(col.dataType);
                    x.summaryType =
                        x.summaryType ||
                        col.aggregate ||
                        (x.dataType == "number" ? "sum" : "count");
                    x.format = x.format || getPivotColFormatType(col);

                    if (
                        angular.isDefined(x.groupInterval) &&
                        x.dataType == "date"
                    ) {
                        delete x.caption;
                        delete x.summaryType;
                        delete x.format;
                    }
                });
                t.load = function (loadOptions) {
                    var defered = $q.defer();

                    esWebApiService
                        .fetchPublicQuery(espqdef)
                        .then(function (pq) {
                            pq = pq.data;
                            defered.resolve(pq.Rows || []);
                        })
                        .catch(function (err) {
                            $log.error("Error in DataSource ", err);
                            defered.resolve([]);
                        });
                    return defered.promise;
                };

                return new DevExpress.data.PivotGridDataSource(t);
            }

            function esExportToExcel(e) {
                var sheet = e.workbook.sheets[0];
                for (var i = 0; i < sheet.rows.length; i++) {
                    var rT = sheet.rows[i].type;
                    if (rT == "group-footer" || rT == "footer") {
                        for (
                            var ci = 0;
                            ci < sheet.rows[i].cells.length;
                            ci++
                        ) {
                            var cCell = sheet.rows[i].cells[ci];
                            if (cCell.value) {
                                cCell.value = $(cCell.value).text();
                                cCell.hAlign = "right";
                                cCell.bold = true;
                            }
                        }
                    }
                }
            }

            function esGridInfoToLocalKInfo(
                esGroupId,
                esFilterId,
                executeParams,
                esGridInfo,
                esDataSource
            ) {
                var grdopt = {
                    pageable: {
                        refresh: true,
                        pageSizes: [20, 50, 100, 1000],
                    },
                    autoBind: false,
                    sortable: true,
                    scrollable: true,
                    selectable: "row",
                    allowCopy: true,
                    resizable: true,
                    reorderable: true,
                    navigatable: true,
                    noRecords: {
                        template:
                            "<h3><span class='label label-info'>" +
                            kendo.ui.Pager.prototype.options.messages.empty +
                            "</span></h3>",
                    },

                    filterable: true,
                    groupable: true,
                    toolbar: ["excel"],
                    excel: {
                        allPages: true,
                        fileName: esGroupId + "-" + esFilterId + ".xlsx",
                        proxyURL:
                            esWebApiService.proxyExportSaveFile("telerik"),
                        forceProxy: true,
                        filterable: true,
                    },
                    excelExport: esExportToExcel,
                };

                if (esGlobals.getESUISettings().mobile) {
                    grdopt.mobile = esGlobals.getESUISettings().mobile;
                }

                if (esGlobals.getESUISettings().defaultGridHeight) {
                    grdopt.height =
                        esGlobals.getESUISettings().defaultGridHeight;
                }

                grdopt.columns = esGridInfo.columns;

                _.map(grdopt.columns, function (c) {
                    if (c.columns) {
                        _.map(c.columns, function (k) {
                            k.footerTemplate = undefined;
                            k.groupFooterTemplate = undefined;
                        });
                    } else {
                        c.footerTemplate = undefined;
                        c.groupFooterTemplate = undefined;
                    }
                });

                grdopt.selectedMasterField = esGridInfo.selectedMasterField;
                grdopt.selectedMasterTable = esGridInfo.selectedMasterTable;
                grdopt.columnMenu = false;

                if (esDataSource) {
                    grdopt.dataSource = esDataSource;
                }

                grdopt.reBind = 0;

                return grdopt;
            }

            function esGridInfoToKInfo(
                esGroupId,
                esFilterId,
                executeParams,
                esGridInfo,
                esPQOptions,
                pqDef
            ) {
                var resOptions =
                    esPQOptions instanceof esGlobals.ESPQOptions
                        ? esPQOptions
                        : new esGlobals.ESPQOptions().initFromObj(esPQOptions);
                var dsOptions = {
                    serverGrouping: false,
                    serverSorting: false,
                    serverFiltering: false,
                    serverAggregates: false,
                    serverPaging: resOptions.ServerPaging,
                    pageSize: resOptions.getPageSizeForUI(),
                };

                var zArr = _.uniq(
                    _.union(
                        [resOptions.getPageSizeForUI()],
                        [20, 50, 100, 1000]
                    )
                ).sort(function (a, b) {
                    return a - b;
                });

                var grdopt = {
                    pageable: {
                        pageSizes: zArr,
                    },
                    autoBind: resOptions.AutoExecute,
                    sortable: !dsOptions.serverPaging,
                    scrollable: true,
                    selectable: "row",
                    allowCopy: true,
                    resizable: true,
                    reorderable: true,
                    navigatable: true,
                    noRecords: {
                        template:
                            "<h3><span class='label label-info'>" +
                            kendo.ui.Pager.prototype.options.messages.empty +
                            "</span></h3>",
                    },

                    filterable:
                        !dsOptions.serverPaging && esGridInfo.FilterLineVisible,
                    groupable:
                        !dsOptions.serverPaging && esGridInfo.GroupByBoxVisible,
                    toolbar: [
                        {
                            name: "run",
                            text: "Run",
                            template:
                                "<a role='button' class='k-button k-button-icontext' ng-click=\"esGridRun()\"><span class='k-icon k-i-reload'/>{{'ESUI.PQ.PARAMS_PANEL_RUN' | translate}}</a>",
                        },

                        {
                            name: "excel",
                            text: "Excel",
                        },
                        {
                            name: "getChecked",
                            text: "Get Checked Items",
                            template: "<a role='button' class='k-button k-button-icontext' ng-click='getCheckedItems()' ng-show='showGetCheckedItemsButton'><span class='k-icon k-i-download'/>{{'ESUI.PQ.DOWNLOAD' | translate}}</span></a>"
                        }
                    ],
                    excel: {
                        allPages: true,
                        proxyURL:
                            esWebApiService.proxyExportSaveFile("telerik"),
                        forceProxy: true,
                        fileName: esGroupId + "-" + esFilterId + ".xlsx",
                        filterable: true,
                    },
                    excelExport: esExportToExcel,
                };

                if (esGlobals.getESUISettings().mobile) {
                    grdopt.mobile = esGlobals.getESUISettings().mobile;
                }

                if (esGlobals.getESUISettings().defaultGridHeight) {
                    grdopt.height =
                        esGlobals.getESUISettings().defaultGridHeight;
                }

                grdopt.groups = esGridInfo.groups;
                grdopt.columns = esGridInfo.columns;
                grdopt.selectedMasterField = esGridInfo.selectedMasterField;
                grdopt.selectedMasterTable = esGridInfo.selectedMasterTable;
                grdopt.columnMenu = false;

                var aggs = _.flatMap(grdopt.columns, function (c) {
                    return c.columns
                        ? _.filter(c.columns, function (k) {
                              return !!k.aggregate;
                          })
                        : !!c.aggregate
                        ? [c]
                        : [];
                });

                grdopt.dataSource = prepareWebScroller(
                    function () {
                        return {
                            GroupID: esGroupId,
                            FilterID: esFilterId,
                            Params: executeParams,
                            SchemaColumns: _.filter(grdopt.columns, {
                                dataType: "datetime",
                            }),
                        };
                    },
                    dsOptions,
                    aggs,
                    grdopt.groups
                );

                if (pqDef && pqDef.UIOptions && pqDef.UIOptions.detailDef) {
                    grdopt.detailInit = detailInit;
                    grdopt.dataBound = function () {
                        this.expandRow(
                            this.tbody.find("tr.k-master-row").first()
                        );
                    };

                    grdopt.detailDef = pqDef.UIOptions.detailDef;
                } 
                
                grdopt.change = handleChangeGridRow;
                grdopt.reBind = 0;
                return grdopt;
            }

            function detailInit(e) {
                console.log("detail init ");

                var detailDef = this.options.detailDef;
                if (!detailDef) {
                    return;
                }

                var masterVal = e.data.ISUDGID || e.data.ISUDCODE;
                if (!masterVal) {
                    console.log(
                        "No value in master row for GID or ISUDGID or ItemCode to query the details"
                    );
                    return;
                }

                var esGroupId = detailDef.GroupID;
                var esFilterId = detailDef.FilterID;

                var esExecuteParams = createESParams({
                    ISUDGID: masterVal,
                });
                var esPQOptions =
                    detailDef.PQOptions ||
                    new esGlobals.ESPQOptions().initFromObj({
                        ServerPaging: false,
                        WithCount: true,
                        AutoExecute: true,
                    });

                esWebApiService
                    .fetchPublicQueryInfo(esGroupId, esFilterId, true, true)
                    .then(function (ret) {
                        var p1 = ret.data;
                        var p2 = winGridInfoToESGridInfo(
                            esGroupId,
                            esFilterId,
                            p1
                        );
                        var esGridOptions = esGridInfoToKInfo(
                            esGroupId,
                            esFilterId,
                            esExecuteParams,
                            p2,
                            esPQOptions
                        );

                        // let only excel toolbar                     
                        esGridOptions.toolbar = [ {
                            name: "excel",
                            text: "Excel",
                        }];

                        $("<div/>")
                            .appendTo(e.detailCell)
                            .kendoGrid(esGridOptions);
                    })
                    .catch(angular.noop);
            }

            function winColToESCol(xGroupID, xFilterID, gridexInfo, jCol) {
                var inFilterID;
                var inGroupID;

                if (angular.isObject(xGroupID)) {
                    inGroupID = xGroupID.GroupID;
                    inFilterID = xGroupID.FilterID;
                } else {
                    inGroupID = xGroupID;
                    inFilterID = xFilterID;
                }
                var esCol = {
                    AA: undefined,
                    field: undefined,
                    title: undefined,
                    width: undefined,
                    visible: undefined,
                    attributes: undefined,
                    enumValues: undefined,
                    formatString: undefined,
                    odsTag: undefined,
                    dataType: undefined,
                    editType: undefined,
                    columnSet: undefined,
                    aggregate: undefined,
                };

                esCol.AA = parseInt(jCol.AA);
                esCol.field = jCol.ColName;
                esCol.title = jCol.Caption;
                esCol.odsTag = jCol.ODSTag;
                esCol.columnSet = parseInt(jCol.ColumnSet);
                esCol.dataType = jCol.DataTypeName
                    ? jCol.DataTypeName.toLowerCase()
                    : undefined;
                esCol.editType = jCol.EditType;
                esCol.width = parseInt(jCol.Width);

                switch (jCol.AggregateFunction) {
                    case "1":
                        esCol.aggregate = "count";
                        break;
                    case "2":
                        esCol.aggregate = "sum";
                        break;
                    case "3":
                        esCol.aggregate = "average";
                        break;
                    case "4":
                        esCol.aggregate = "min";
                        break;
                    case "5":
                        esCol.aggregate = "max";
                        break;
                }

                esCol.formatString = jCol.FormatString;
                esCol.visible = jCol.Visible == "true";

                var esClass = esCol.dataType;
                switch (esCol.dataType) {
                    case "byte": {
                        if (esCol.editType == 8) {
                            esClass = "boolean-checkbox";
                        }
                        break;
                    }
                }

                esCol.attributes = {
                    class: "es-grid-cell-" + esClass,
                };

                if (jCol.TextAlignment == "3") {
                    esCol.attributes.style = "text-align: right;";
                }

                if (esClass === "decimal") {
                    esCol.attributes.style =
                        (esCol.attributes.style || "") +
                        " # if(" +
                        esCol.field +
                        " < 0) { #color:red;# } # ";
                }

                //Enum Column
                if (jCol.EditType == "5") {
                    var l1 = _.sortBy(
                        _.filter(gridexInfo.ValueList, function (x) {
                            var v = x.ColName == jCol.ColName;
                            v = v && typeof x.Value != "undefined";
                            v = v && x.fFilterID.toLowerCase() == inFilterID;
                            return v;
                        }),
                        function (x) {
                            return !isNaN(x.Value) ? parseInt(x.Value) : null;
                        }
                    );
                    var l2 = _.map(l1, function (x) {
                        return {
                            text: x.Caption,
                            value: !isNaN(x.Value) ? parseInt(x.Value) : null,
                        };
                    });

                    if (l2 && l2.length) {
                        esCol.enumValues = l2;
                    }
                }
                return esCol;
            }

            function esEval(pInfo, expr) {
                var EQ = {
                    oper: "EQ",
                    paramID: pInfo.id,
                };
                var GE = {
                    oper: "GE",
                    paramID: pInfo.id,
                };
                var GT = {
                    oper: "GT",
                    paramID: pInfo.id,
                };
                var LE = {
                    oper: "LE",
                    paramID: pInfo.id,
                };
                var LT = {
                    oper: "LT",
                    paramID: pInfo.id,
                };
                var NE = {
                    oper: "NE",
                    paramID: pInfo.id,
                };
                var RANGE = {
                    oper: "RANGE",
                    paramID: pInfo.id,
                };
                var NULL = {
                    oper: "NULL",
                    paramID: pInfo.id,
                };
                var NOTNULL = {
                    oper: "NOTNULL",
                    paramID: pInfo.id,
                };
                return eval(expr);
            }

            function ESNumeric(inArg, val, val2) {
                if (val && angular.isString(val)) {
                    val = val.replace(".", "").replace(",", ".");
                }

                if (val2 && angular.isString(val2)) {
                    val2 = val.replace(".", "").replace(",", ".");
                }
                var k = {
                    value: !isNaN(val) ? new Number(val).valueOf() : null,
                    valueTo: !isNaN(val2) ? new Number(val2).valueOf() : null,
                    oper: inArg.oper || "EQ",
                };
                return new esGlobals.ESNumericParamVal(inArg.paramID, k);
            }

            function ESString(inArg, val, val2) {
                var k = {
                    value: val,
                    valueTo: val2,
                    oper: inArg.oper || "EQ",
                };
                return new esGlobals.ESStringParamVal(inArg.paramID, k);
            }

            function createEsParamVal(obj) {
                if (!obj || !obj.id) {
                    return null;
                }

                var dx = obj.value || [];
                dx = angular.isArray(dx) ? dx : [dx];
                var pinfo = new ESParamInfo();
                angular.merge(pinfo, obj);
                dx = _.map(dx, function (k) {
                    return { Value: k };
                });
                return getEsParamVal(pinfo, dx);
            }

            function createESParams(obj) {
                if (!obj) {
                    return new esGlobals.ESParamValues();
                }

                var p = [];
                if (angular.isArray(obj)) {
                    _.map(obj, function (x) {
                        var par = createEsParamVal(x);
                        if (par) {
                            p.push(par);
                        }
                    });
                } else {
                    if (obj instanceof esGlobals.ESParamValues) {
                        var dN = new esGlobals.ESParamValues();
                        dN.merge(obj);
                        return dN;
                    }

                    for (var key in obj) {
                        var val = obj[key];
                        var par1 = createEsParamVal({
                            id: key,
                            value: val,
                        });
                        if (par1) {
                            p.push(par1);
                        }
                    }
                }

                return new esGlobals.ESParamValues(p);
            }

            function ESParamInfo(p) {
                this.id = p ? p.id : undefined;
                this.aa = p ? p.aa : undefined;
                this.caption = p ? p.caption : undefined;
                this.toolTip = p ? p.toolTip : undefined;
                this.controlType = p ? p.controlType : undefined;
                this.parameterType =
                    p && p.parameterType ? p.parameterType : "";
                this.precision = p ? p.precision : undefined;
                this.multiValued = p ? p.multiValued : false;
                this.visible = p ? p.visible : undefined;
                this.required = p ? p.required : undefined;
                this.oDSTag = p ? p.oDSTag : undefined;
                this.formatString = p ? p.formatString : undefined;
                this.tags = p ? p.tags : undefined;
                this.visibility = p ? p.visibility : undefined;
                this.invQueryID = p ? p.invQueryID : undefined;
                this.invSelectedMasterTable = p
                    ? p.invSelectedMasterTable
                    : undefined;
                this.invSelectedMasterField = p
                    ? p.invSelectedMasterField
                    : undefined;
                this.invTableMappings = p ? p.invTableMappings : undefined;
                this.enumOptionAll = p ? p.enumOptionAll : undefined;
                this.enumList = p ? p.enumList : undefined;
                this.defaultValues = p
                    ? getEsParamVal(this, p.defaultValues)
                    : undefined;
                this.inputType = p && p.inputType ? p.inputType : "";
            }

            ESParamInfo.prototype.paramTemplate = function () {
                var pParam = this;

                if (!pParam || !pParam.parameterType) {
                    return "esParamText";
                }

                var pt = pParam.parameterType.toLowerCase();

                if (pt.indexOf("system.int32, mscorlib") == 0) {
                    switch (pParam.controlType) {
                        case 7:
                            return "esParamBoolean";
                        default: {
                            if (!pParam.enumList || !pParam.enumList.length) {
                                return "esParamNumeric";
                            }
                        }
                    }
                }

                //ESDateRange
                if (
                    pt.indexOf(
                        "entersoft.framework.platform.esdaterange, queryprocess"
                    ) == 0
                ) {
                    return "esParamDateRange";
                }

                //ESNumeric
                if (pt.indexOf("entersoft.framework.platform.esnumeric") == 0) {
                    return "esParamAdvancedNumeric";
                }

                //ESString
                if (
                    pt.indexOf(
                        "entersoft.framework.platform.esstring, queryprocess"
                    ) == 0
                ) {
                    return "esParamAdvancedString";
                }

                // Numeric (Integer or Decimal)
                if (pt.indexOf("system.string, mscorlib") == 0) {
                    switch (pParam.controlType) {
                        case 1:
                            {
                                return "esParamNumeric";
                            }
                            break;
                        case 2:
                            {
                                return "esParamNumeric";
                            }
                            break;
                    }
                }

                //case Enum
                if (pParam.enumList && pParam.enumList.length > 1) {
                    if (pParam.multiValued || pParam.enumOptionAll) {
                        return "esParamMultiEnum";
                    } else {
                        return "esParamEnum";
                    }
                }

                if (pParam.isInvestigateZoom()) {
                    if (!pParam.invSelectedMasterField) {
                        pParam.invSelectedMasterField = "Code";
                    }
                    if (pParam.multiValued) {
                        return "esParamMultiZoom";
                    } else {
                        return "esParamZoom";
                    }
                } else {
                    if (pParam.isInvestigateEntity()) return "esParamInv";

                    return "esParamText";
                }
            };

            ESParamInfo.prototype.strVal = function () {
                return "Hello World esParaminfo";
            };

            ESParamInfo.prototype.isAdvanced = function () {
                return this.visible && this.visibility == 1;
            };

            ESParamInfo.prototype.isInvestigateZoom = function () {
                return (
                    this.invSelectedMasterTable &&
                    this.invSelectedMasterTable.length > 4 &&
                    this.invSelectedMasterTable[4] == "Z"
                );
            };

            ESParamInfo.prototype.getTag = function (tagid) {
                if (!this.tags) {
                    return "";
                }

                var id = _.find(this.tags, function (k) {
                    return k.startsWith(tagid);
                });
                return id;
            };

            ESParamInfo.prototype.isInvestigateEntity = function () {
                if (this.isInvestigateZoom() || !this.getTag("INVPQ:"))
                    return false;

                return true;
            };

            ESParamInfo.prototype.isDisplayedInHeader = function () {
                if (!this.tags || !this.getTag("TITLEPQ:")) return false;

                return true;
            };

            function getEsParamVal(esParamInfo, dx) {
                var ps = esParamInfo.parameterType.toLowerCase();

                //ESNumeric
                if (ps.indexOf("entersoft.framework.platform.esnumeric") == 0) {
                    if (!dx || dx.length == 0) {
                        return new esGlobals.ESNumericParamVal(esParamInfo.id, {
                            oper: "EQ",
                            value: 0,
                        }).required(esParamInfo.required);
                    }
                    return esEval(esParamInfo, dx[0].Value).required(
                        esParamInfo.required
                    );
                }

                // boolean
                if (
                    ps.indexOf("system.int32, mscorlib") == 0 &&
                    esParamInfo.controlType == 7
                ) {
                    var bVal = 0;
                    if (dx && dx.length > 0) {
                        bVal = parseInt(dx[0].Value);
                    }
                    return new esGlobals.ESBoolParamVal(
                        esParamInfo.id,
                        !!bVal
                    ).required(esParamInfo.required);
                }

                //ESDateRange
                if (
                    ps.indexOf(
                        "entersoft.framework.platform.esdaterange, queryprocess"
                    ) == 0
                ) {
                    if (!dx || dx.length == 0) {
                        return new esGlobals.ESDateParamVal(
                            esParamInfo.id,
                            esParamInfo.controlType == 6
                                ? null
                                : {
                                      dRange: "ESDateRange(FiscalPeriod)",
                                      fromD: null,
                                      toD: null,
                                  }
                        ).required(esParamInfo.required);
                    }
                    return new esGlobals.ESDateParamVal(
                        esParamInfo.id,
                        dx[0].Value
                    ).required(esParamInfo.required);
                }

                //ESString
                if (
                    ps.indexOf(
                        "entersoft.framework.platform.esstring, queryprocess"
                    ) == 0
                ) {
                    if (!dx || dx.length == 0) {
                        return new esGlobals.ESStringParamVal(esParamInfo.id, {
                            oper: "EQ",
                            value: null,
                        }).required(esParamInfo.required);
                    }

                    return esEval(esParamInfo, dx[0].Value).required(
                        esParamInfo.required
                    );
                }

                //Not set
                if (!dx || dx.length == 0) {
                    var orgVal = esParamInfo.multiValued ? [] : null;
                    return new esGlobals.ESParamVal(
                        esParamInfo.id,
                        orgVal,
                        esParamInfo.enumList
                    ).required(esParamInfo.required);
                }

                var processedVals = _.map(dx, function (k) {
                    return processStrToken(esParamInfo, k.Value);
                });

                if (processedVals.length == 1) {
                    processedVals = processedVals[0];
                }
                return new esGlobals.ESParamVal(
                    esParamInfo.id,
                    processedVals,
                    esParamInfo.enumList
                ).required(esParamInfo.required);
            }

            function processStrToken(esParamInfo, val) {
                if (!esParamInfo) {
                    return val;
                }

                var ps = esParamInfo.parameterType.toLowerCase();
                if (
                    ps.indexOf("system.byte") != -1 ||
                    ps.indexOf("system.int") != -1
                ) {
                    return parseInt(val);
                }

                if (esParamInfo.enumList && esParamInfo.enumList.length > 1) {
                    return val;
                }

                if (!_.startsWith(val, "##(")) {
                    if (ps == "system.datetime, mscorlib") {
                        return new Date(val).toISOString();
                    }
                    return val;
                }

                switch (val.toLowerCase()) {
                    case "##(esbranch)":
                        var m = esGlobals.getClientSession();
                        if (m && m.connectionModel) {
                            return m.connectionModel.BranchID;
                        }
                        return val;

                    default:
                        return val;
                }
            }

            function ESParamsDefinitions(title, params) {
                this.title = title;
                this.definitions = params;
                this.paramsValues = null;
            }

            ESParamsDefinitions.prototype.createDefinitions = function (
                title,
                params,
                paramVals
            ) {
                this.title = title;
                if (!params || !angular.isArray(params)) {
                    this.definitions = [];
                    return this;
                }

                this.definitions = _.map(params, function (p) {
                    var dx;
                    if (paramVals && angular.isArray(paramVals)) {
                        dx = _.filter(paramVals, {
                            id: p.id,
                        });
                    }

                    return new ESParamInfo(p, dx);
                });

                var dfValues = _.map(this.definitions, function (p) {
                    return p.defaultValues;
                });

                this.paramsValues = new esGlobals.ESParamValues(dfValues);
                return this;
            };

            ESParamsDefinitions.prototype.getParamsValues = function () {
                return this.paramsValues;
            };

            ESParamsDefinitions.prototype.visibleDefinitions = function (
                includeAdvanced
            ) {
                var f = this.definitions;
                if (!f) {
                    return [];
                }

                return _.filter(f, function (g) {
                    if (!g.visible) {
                        return false;
                    }

                    if (!includeAdvanced) {
                        return !g.isAdvanced();
                    }
                    return true;
                });
            };

            ESParamsDefinitions.prototype.simpleDefinitions = function () {
                var f = this.definitions;
                var t = f
                    ? _.filter(f, function (g) {
                          return g.visible && g.visibility != 1;
                      })
                    : [];

                return t;
            };

            ESParamsDefinitions.prototype.advancedDefinitions = function () {
                var f = this.definitions;
                return f
                    ? _.filter(f, function (g) {
                          return g.isAdvanced();
                      })
                    : [];
            };

            ESParamsDefinitions.prototype.hasVisibleParams = function () {
                var f = this.definitions;
                if (!f) {
                    return false;
                }

                return (
                    _.filter(f, function (g) {
                        return g.visible;
                    }).length > 0
                );
            };

            ESParamsDefinitions.prototype.hasAdvancedParams = function () {
                var f = this.definitions;
                return this.advancedDefinitions().length >= 1;
            };

            ESParamsDefinitions.prototype.strVal = function (
                vals,
                onlyDisplayInHeader,
                separator
            ) {
                if (
                    !vals ||
                    !this.definitions ||
                    this.definitions.length == 0
                ) {
                    return "";
                }

                separator = separator || " / ";

                var eligible = _.filter(this.definitions, function (p) {
                    return (
                        p.visible &&
                        vals[p.id].strVal() &&
                        (onlyDisplayInHeader ? p.getTag("TITLEPQ:") : true)
                    );
                });

                var s = _.reduce(
                    _.sortBy(eligible, "aa"),
                    function (memo, p) {
                        return (
                            memo +
                            p.caption +
                            ": " +
                            vals[p.id].strVal() +
                            separator
                        );
                    },
                    ""
                );

                return s.substring(0, s.lastIndexOf(separator));
            };

            function winParamInfoToesParamInfo(winParamInfo, gridexInfo) {
                if (!winParamInfo) {
                    return null;
                }

                var espInfo = new ESParamInfo();

                espInfo.id = winParamInfo.ID;
                espInfo.aa = parseInt(winParamInfo.AA);
                espInfo.caption = winParamInfo.Caption;
                espInfo.toolTip = winParamInfo.Tooltip;
                espInfo.controlType = parseInt(winParamInfo.ControlType);
                espInfo.parameterType = winParamInfo.ParameterType;
                espInfo.precision = parseInt(winParamInfo.Precision);
                espInfo.multiValued = winParamInfo.MultiValued == "true";
                espInfo.visible = winParamInfo.Visible == "true";
                espInfo.required = winParamInfo.Required == "true";
                espInfo.oDSTag = winParamInfo.ODSTag;
                espInfo.tags = winParamInfo.Tags
                    ? winParamInfo.Tags.split("[(,)]")
                    : "";
                espInfo.visibility = parseInt(winParamInfo.Visibility);
                espInfo.invQueryID = winParamInfo.InvQueryID;
                espInfo.invSelectedMasterTable =
                    winParamInfo.InvSelectedMasterTable;
                espInfo.invSelectedMasterField =
                    winParamInfo.InvSelectedMasterField;
                espInfo.invTableMappings = winParamInfo.InvTableMappings;

                espInfo.enumOptionAll = winParamInfo.EnumOptionAll;
                var enmList = _.map(
                    _.filter(gridexInfo.EnumItem, function (x) {
                        return (
                            x.fParamID == espInfo.id &&
                            typeof x.ID != "undefined"
                        );
                    }),
                    function (e) {
                        return {
                            text: espInfo.oDSTag
                                ? e.Caption.substring(
                                      e.Caption.indexOf(".") + 1
                                  )
                                : e.Caption,
                            value: e.ID,
                        };
                    }
                );

                espInfo.enumList = enmList.length ? enmList : undefined;

                var gxDef = gridexInfo.DefaultValue;
                if (gxDef && angular.isArray(gxDef)) {
                    var dx = _.filter(gxDef, {
                        fParamID: espInfo.id,
                    });

                    espInfo.defaultValues = getEsParamVal(espInfo, dx);
                } else {
                    espInfo.defaultValues = getEsParamVal(espInfo, []);
                }

                return espInfo;
            }

            function winGridInfoToESGridInfo(xGroupID, xFilterID, gridexInfo) {
                if (!gridexInfo || !gridexInfo.LayoutColumn) {
                    return null;
                }

                var inFilterID;
                var inGroupID;
                if (angular.isObject(xGroupID)) {
                    inGroupID = xGroupID.GroupID;
                    inFilterID = xGroupID.FilterID;
                } else {
                    inGroupID = xGroupID;
                    inFilterID = xFilterID;
                }
                var fId = inFilterID.toLowerCase();
                var filterInfo = _.filter(gridexInfo.Filter, function (x) {
                    return x.ID.toLowerCase() == fId;
                });

                if (!filterInfo || filterInfo.length != 1) {
                    return null;
                }

                var esGridInfo = {
                    id: undefined,
                    caption: undefined,
                    rootTable: undefined,
                    selectedMasterTable: undefined,
                    selectedMasterField: undefined,
                    columnSets: undefined,
                    columns: undefined,
                    params: undefined,
                    defaultValues: undefined,
                    groups: undefined,
                    totalRow: false,
                };

                esGridInfo.groups = _.map(
                    _.filter(gridexInfo.LayoutGroup, function (y) {
                        return y.fFilterID.toLowerCase() == fId;
                    }),
                    function (x) {
                        return {
                            field: x.ColName,
                            aa: x.AA,
                            sortOrder: x.SortOrder,
                        };
                    }
                );

                filterInfo = filterInfo[0];
                esGridInfo.id = filterInfo.ID;
                esGridInfo.caption = filterInfo.Caption;
                esGridInfo.rootTable = filterInfo.RootTable;
                esGridInfo.selectedMasterTable = filterInfo.SelectedMasterTable;
                esGridInfo.selectedMasterField = filterInfo.SelectedMasterField;
                esGridInfo.totalRow = filterInfo.TotalRow != "0";

                var z2 = _.map(
                    _.filter(gridexInfo.LayoutColumn, function (y) {
                        return (
                            y.fFilterID.toLowerCase() == fId &&
                            y.DataTypeName != "Guid"
                        );
                    }),
                    function (x) {
                        return winColToESCol(inGroupID, fId, gridexInfo, x);
                    }
                );

                var z1 = _.sortBy(z2, function (x) {
                    return parseInt(x.AA);
                });

                var clickCol = _.find(z1, function (x) {
                    return x.visible && x.dataType == "string";
                });

                var z3 = _.map(z1, function (x) {
                    var showForm = clickCol
                        ? {
                              showCol: clickCol.field,
                              selectedMasterField:
                                  esGridInfo.selectedMasterField,
                              selectedState: (
                                  esGridInfo.selectedMasterTable || ""
                              ).toLowerCase(),
                          }
                        : undefined;

                    return esColToKCol(x, showForm, esGridInfo);
                });

                esGridInfo.columnSets = _.sortBy(
                    _.map(
                        _.filter(gridexInfo.LayoutColumnSet, function (x) {
                            return x.fFilterID.toLowerCase() == fId;
                        }),
                        function (p) {
                            return {
                                aa: parseInt(p.Position),
                                title: p.Caption,
                                columns: undefined,
                            };
                        }
                    ),
                    "aa"
                );

                esGridInfo.columns = z3;
                // now process the column sets
                // put column sets first
                if (esGridInfo.columnSets && esGridInfo.columnSets.length > 0) {
                    _.each(esGridInfo.columnSets, function (x) {
                        x.columns = _.filter(z3, {
                            columnSet: x.aa,
                        });
                        z3 = _.difference(z3, x.columns);
                    });

                    esGridInfo.columnSets = _.sortBy(
                        _.filter(esGridInfo.columnSets, function (x) {
                            return x.columns && x.columns.length > 0;
                        }),
                        "aa"
                    );

                    z3 = esGridInfo.columnSets.concat(z3);
                    esGridInfo.columns = z3;
                } else {
                    // No column sets defined, so just list the columns
                    esGridInfo.columns = z3;
                }

                esGridInfo.params = new ESParamsDefinitions(
                    esGridInfo.caption,
                    _.map(gridexInfo.Param, function (p) {
                        return winParamInfoToesParamInfo(p, gridexInfo);
                    })
                );

                var dfValues = _.map(
                    esGridInfo.params.definitions,
                    function (p) {
                        return p.defaultValues;
                    }
                );

                esGridInfo.defaultValues = new esGlobals.ESParamValues(
                    dfValues
                );
                return esGridInfo;
            }

            return {
                ESRequeryDetailGrids: ESRequeryDetailGrids,
                ESMasterDetailGridRelation: ESMasterDetailGridRelation,

                /**
* @ngdoc function
* @name es.Web.UI.esUIHelper#winGridInfoToESGridInfo
* @methodOf es.Web.UI.esUIHelper
* @module es.Web.UI
* @kind function
* @description  This function processes and transforms an Entersoft Windows - Janus specific definition of the UI layout of an
* Entersoft Public Query or Entersoft Scroller to an abstract web-oriented defintion of the layout to be used by WEB UI components
* such as telerik kendo-ui, jQuery grids, etc.
* @param {string|ESPublicQueryDef} xGroupID if string then Entersoft Public Query GroupID or a {@link es.Services.Web.esGlobals#methods_ESPublicQueryDef ESPublicQueryDef} object that defines the rest of the parameters
* @param {string} xFilterID Entersoft Public Query FilterID. In case that pqGroupID is ESPublicQueryDef type then this parameter can be null or undefined
* @param {object} gridexInfo The definition object for an Entersoft Public Query (or Scroller) as provided by the result
* of the function {@link es.Services.Web.esWebApi#methods_fetchPublicQueryInfo fetchPublicQueryInfo}.
* @return {object} Returns an object that is the abstract (not Janus specific) representation of the gridexInfo.
* @example
```js
var inGroupID = "ESMMStockItem";
var inFilterID = "ESMMStockItem_Def";
var gridexInfo = {
"Filter": [{
"ID": "ESMMStockItem_Def",
"Caption": "Είδη Αποθήκης",
"QueryID": "ESMMStockItem\\ESMMStockItem_Def\\ESMMStockItem_Def_Q1.esq",
"RootTable": "ESFIItem",
"SelectedMasterTable": "ESFIItem",
"SelectedMasterField": "ISUDGID",
"TotalRow": "0",
"ColumnHeaders": "0",
"ColumnSetHeaders": "0",
"ColumnSetRowCount": "2",
"ColumnSetHeaderLines": "1",
"HeaderLines": "1",
"GroupByBoxVisible": "false",
"FilterLineVisible": "false",
"PreviewRow": "false",
"PreviewRowMember": "",
"PreviewRowLines": "3"
}],
"Param": [{
"ID": "ESDCreated",
"AA": "1",
"Caption": "Ημ/νία δημιουργίας",
"Tooltip": "Ημ/νία δημιουργίας",
"ControlType": "6",
"ParameterType": "Entersoft.Framework.Platform.ESDateRange, QueryProcess",
"Precision": "0",
"MultiValued": "false",
"Visible": "true",
"Required": "false",
"ODSTag": "AA049FD6-4EFF-499F-8F6B-0573BD14D183",
"Tags": "",
"Visibility": "0"
}, {
"ID": "ESUCreated",
"AA": "2",
"Caption": "Χρήστης δημιουργίας",
"Tooltip": "Χρήστης δημιουργίας",
"ControlType": "9",
"ParameterType": "Entersoft.Framework.Platform.ESString, QueryProcess",
"Precision": "0",
"MultiValued": "false",
"Visible": "true",
"Required": "false",
"ODSTag": "0ABDC77C-119B-4729-A99F-C226EBCE0C1B",
"Tags": "",
"Visibility": "0"
}, {
"ID": "ESDModified",
"AA": "3",
"Caption": "Ημ/νία τελ.μεταβολής",
"Tooltip": "Ημ/νία τελ.μεταβολής",
"ControlType": "20",
"ParameterType": "Entersoft.Framework.Platform.ESDateRange, QueryProcess",
"Precision": "0",
"MultiValued": "false",
"Visible": "true",
"Required": "false",
"ODSTag": "4E4E17A4-ECA5-4CB0-9F11-02C943F6E6C8",
"Tags": "",
"Visibility": "0"
}],
"DefaultValue": [{
"fParamID": "ESDCreated",
"Value": "#2006/04/15#"
}, {
"fParamID": "ESUCreated",
"Value": "ESString(RANGE, 'wλμ', 'χχω')"
}, {
"fParamID": "ESDModified",
"Value": "#2011/03/14#"
}],
"LayoutColumn": [{
"fFilterID": "ESMMStockItem_Def",
"ColName": "Code",
"AA": "0",
"Caption": "Κωδικός",
"FormatString": "",
"Width": "100",
"ODSTag": "74C82778-6B49-4928-9F06-81B4384BF677",
"Visible": "true",
"ColumnSetRow": "-1",
"ColumnSetColumn": "-1",
"RowSpan": "-1",
"ColSpan": "-1",
"AggregateFunction": "0",
"TextAlignment": "1",
"EditType": "1",
"DataTypeName": "String"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "Description",
"AA": "4",
"Caption": "Περιγραφή",
"FormatString": "",
"Width": "100",
"ODSTag": "2B666760-3FA7-478A-8112-CCC77FBC754E",
"Visible": "true",
"ColumnSetRow": "-1",
"ColumnSetColumn": "-1",
"RowSpan": "-1",
"ColSpan": "-1",
"AggregateFunction": "0",
"TextAlignment": "1",
"EditType": "1",
"DataTypeName": "String"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "AlternativeDescription",
"AA": "5",
"Caption": "Εναλλακτική περιγραφή",
"FormatString": "",
"Width": "100",
"ODSTag": "A8E42370-78F3-4F38-BB65-F861B6DD1F84",
"Visible": "false",
"ColumnSetRow": "-1",
"ColumnSetColumn": "-1",
"RowSpan": "-1",
"ColSpan": "-1",
"AggregateFunction": "0",
"TextAlignment": "1",
"EditType": "1",
"DataTypeName": "String"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "Price",
"AA": "6",
"Caption": "Τιμή χονδρικής",
"FormatString": "#,0.00",
"Width": "100",
"ODSTag": "FC8D207E-FE62-4791-98C0-C5787C8940AD",
"Visible": "true",
"ColumnSetRow": "-1",
"ColumnSetColumn": "-1",
"RowSpan": "-1",
"ColSpan": "-1",
"AggregateFunction": "0",
"TextAlignment": "3",
"EditType": "1",
"DataTypeName": "Decimal"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "RetailPrice",
"AA": "7",
"Caption": "Τιμή λιανικής",
"FormatString": "#,0.00",
"Width": "100",
"ODSTag": "F1FE2820-573E-41A5-B0A8-5DE247EEC20A",
"Visible": "true",
"ColumnSetRow": "-1",
"ColumnSetColumn": "-1",
"RowSpan": "-1",
"ColSpan": "-1",
"AggregateFunction": "0",
"TextAlignment": "3",
"EditType": "1",
"DataTypeName": "Decimal"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "AssemblyType",
"AA": "8",
"Caption": "Τύπος σύνθεσης",
"FormatString": "",
"Width": "100",
"ODSTag": "AEAA32D3-E015-4891-AEB9-8A60ABBCA9AF",
"Visible": "true",
"ColumnSetRow": "-1",
"ColumnSetColumn": "-1",
"RowSpan": "-1",
"ColSpan": "-1",
"AggregateFunction": "0",
"TextAlignment": "1",
"EditType": "5",
"DataTypeName": "Byte"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ItemClass",
"AA": "9",
"Caption": "Κλάση",
"FormatString": "",
"Width": "100",
"ODSTag": "82538EA3-8EF0-4E8F-A395-9EF1466DCFB6",
"Visible": "true",
"ColumnSetRow": "-1",
"ColumnSetColumn": "-1",
"RowSpan": "-1",
"ColSpan": "-1",
"AggregateFunction": "0",
"TextAlignment": "1",
"EditType": "5",
"DataTypeName": "Byte"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ItemType",
"AA": "10",
"Caption": "Τύπος",
"FormatString": "",
"Width": "100",
"ODSTag": "0107AD25-0F2D-41F6-9D59-4C6B1CC0FE30",
"Visible": "true",
"ColumnSetRow": "-1",
"ColumnSetColumn": "-1",
"RowSpan": "-1",
"ColSpan": "-1",
"AggregateFunction": "0",
"TextAlignment": "1",
"EditType": "5",
"DataTypeName": "Byte"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "Name",
"AA": "11",
"Caption": "Επωνυμία/Ονοματεπώνυμο",
"FormatString": "",
"Width": "100",
"ODSTag": "7699C12E-3B5F-47E8-B509-7AF97F4560B1",
"Visible": "true",
"ColumnSetRow": "-1",
"ColumnSetColumn": "-1",
"RowSpan": "-1",
"ColSpan": "-1",
"AggregateFunction": "0",
"TextAlignment": "1",
"EditType": "1",
"DataTypeName": "String"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "Description1",
"AA": "12",
"Caption": "Περιγραφή1",
"FormatString": "",
"Width": "100",
"ODSTag": "2BF1AC3B-BDB3-4239-A9D1-696793981822",
"Visible": "true",
"ColumnSetRow": "-1",
"ColumnSetColumn": "-1",
"RowSpan": "-1",
"ColSpan": "-1",
"AggregateFunction": "0",
"TextAlignment": "1",
"EditType": "1",
"DataTypeName": "String"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "fItemFamilyCode",
"AA": "13",
"Caption": "Οικογένεια",
"FormatString": "",
"Width": "100",
"ODSTag": "7D4D3335-3D6D-45B5-A1D3-FF237A33867C",
"Visible": "true",
"ColumnSetRow": "-1",
"ColumnSetColumn": "-1",
"RowSpan": "-1",
"ColSpan": "-1",
"AggregateFunction": "0",
"TextAlignment": "1",
"EditType": "1",
"DataTypeName": "String"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "fItemGroupCode",
"AA": "14",
"Caption": "Ομάδα",
"FormatString": "",
"Width": "100",
"ODSTag": "CE625D36-7744-4DF9-9AFA-2F0851F9B025",
"Visible": "true",
"ColumnSetRow": "-1",
"ColumnSetColumn": "-1",
"RowSpan": "-1",
"ColSpan": "-1",
"AggregateFunction": "0",
"TextAlignment": "1",
"EditType": "1",
"DataTypeName": "String"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "fItemCategoryCode",
"AA": "15",
"Caption": "Κατηγορία",
"FormatString": "",
"Width": "100",
"ODSTag": "19AB9EB4-7791-4090-8AF6-F9434B031EF0",
"Visible": "true",
"ColumnSetRow": "-1",
"ColumnSetColumn": "-1",
"RowSpan": "-1",
"ColSpan": "-1",
"AggregateFunction": "0",
"TextAlignment": "1",
"EditType": "1",
"DataTypeName": "String"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "fItemSubcategoryCode",
"AA": "16",
"Caption": "Υποκατηγορία",
"FormatString": "",
"Width": "100",
"ODSTag": "22E443E1-9A08-4FAD-835A-6B7C15A844C2",
"Visible": "true",
"ColumnSetRow": "-1",
"ColumnSetColumn": "-1",
"RowSpan": "-1",
"ColSpan": "-1",
"AggregateFunction": "0",
"TextAlignment": "1",
"EditType": "1",
"DataTypeName": "String"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ESDCreated",
"AA": "1",
"Caption": "Ημ/νία δημιουργίας",
"FormatString": "d",
"Width": "100",
"ODSTag": "AA049FD6-4EFF-499F-8F6B-0573BD14D183",
"Visible": "true",
"ColumnSetRow": "-1",
"ColumnSetColumn": "-1",
"RowSpan": "-1",
"ColSpan": "-1",
"AggregateFunction": "0",
"TextAlignment": "1",
"EditType": "0",
"DataTypeName": "DateTime"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ESDModified",
"AA": "2",
"Caption": "Ημ/νία τελ.μεταβολής",
"FormatString": "d",
"Width": "100",
"ODSTag": "4E4E17A4-ECA5-4CB0-9F11-02C943F6E6C8",
"Visible": "true",
"ColumnSetRow": "-1",
"ColumnSetColumn": "-1",
"RowSpan": "-1",
"ColSpan": "-1",
"AggregateFunction": "0",
"TextAlignment": "1",
"EditType": "0",
"DataTypeName": "DateTime"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ESUCreated",
"AA": "3",
"Caption": "Χρήστης δημιουργίας",
"FormatString": "",
"Width": "100",
"ODSTag": "0ABDC77C-119B-4729-A99F-C226EBCE0C1B",
"Visible": "true",
"ColumnSetRow": "-1",
"ColumnSetColumn": "-1",
"RowSpan": "-1",
"ColSpan": "-1",
"AggregateFunction": "0",
"TextAlignment": "1",
"EditType": "0",
"DataTypeName": "String"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ESUModified",
"AA": "17",
"Caption": "Χρήστης τελ.μεταβολής",
"FormatString": "",
"Width": "100",
"ODSTag": "FC41CA99-AC07-45B5-825F-3982037E148C",
"Visible": "true",
"ColumnSetRow": "-1",
"ColumnSetColumn": "-1",
"RowSpan": "-1",
"ColSpan": "-1",
"AggregateFunction": "0",
"TextAlignment": "1",
"EditType": "0",
"DataTypeName": "String"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "Comment",
"AA": "18",
"Caption": "Σχόλιο",
"FormatString": "",
"Width": "100",
"ODSTag": "BD9B18D3-BA45-4FA7-911A-C66ACA556AB9",
"Visible": "true",
"ColumnSetRow": "-1",
"ColumnSetColumn": "-1",
"RowSpan": "-1",
"ColSpan": "-1",
"AggregateFunction": "0",
"TextAlignment": "1",
"EditType": "1",
"DataTypeName": "String"
}],
"ValueList": [{
"fFilterID": "ESMMStockItem_Def",
"ColName": "AssemblyType",
"Value": "0",
"Caption": "Απλό"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "AssemblyType",
"Value": "1",
"Caption": "Σετ"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "AssemblyType",
"Value": "2",
"Caption": "Παραγόμενο"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ItemClass",
"Value": "0",
"Caption": "Γενικό είδος-Υπηρεσία"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ItemClass",
"Value": "1",
"Caption": "Είδος Αποθήκης"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ItemClass",
"Value": "2",
"Caption": "Πάγιο"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ItemType",
"Value": "0",
"Caption": "Εμπόρευμα"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ItemType",
"Value": "1",
"Caption": "Προϊόν"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ItemType",
"Value": "8",
"Caption": "Ημιέτοιμο"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ItemType",
"Value": "2",
"Caption": "Ά ύλη"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ItemType",
"Value": "9",
"Caption": "Β’ύλη"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ItemType",
"Value": "12",
"Caption": "Υλικό συσκευασίας"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ItemType",
"Value": "3",
"Caption": "Ανταλλακτικό"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ItemType",
"Value": "4",
"Caption": "Αναλώσιμο"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ItemType",
"Value": "5",
"Caption": "Είδος συσκευασίας"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ItemType",
"Value": "6",
"Caption": "Eίδος εγγυοδοσίας"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ItemType",
"Value": "10",
"Caption": "Προϋπ/να έσοδα"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ItemType",
"Value": "11",
"Caption": "Προϋπ/να έξοδα"
}, {
"fFilterID": "ESMMStockItem_Def",
"ColName": "ItemType",
"Value": "7",
"Caption": "Άλλο"
}],
"FormatingCondition": [{
"fFilterID": "ESMMStockItem_Def",
"Key": "PriceMarkNegativeValues",
"AllowMerge": "true",
"ColumnKey": "Price",
"ConditionOperator": "3",
"Value1": "0",
"TargetColumnKey": "Price",
"fFormatStyleKey": "1ecd5e8f-b3d0-4a02-b9ac-d70a36ee4d41"
}, {
"fFilterID": "ESMMStockItem_Def",
"Key": "RetailPriceMarkNegativeValues",
"AllowMerge": "true",
"ColumnKey": "RetailPrice",
"ConditionOperator": "3",
"Value1": "0",
"TargetColumnKey": "RetailPrice",
"fFormatStyleKey": "3a9999f7-322b-437d-abbf-43ded2a4bec6"
}],
"FormatStyle": [{
"Key": "1ecd5e8f-b3d0-4a02-b9ac-d70a36ee4d41",
"BackColor": "0",
"ForeColor": "-65536",
"FontBold": "0",
"FontItalic": "0",
"FontStrikeout": "0"
}, {
"Key": "3a9999f7-322b-437d-abbf-43ded2a4bec6",
"BackColor": "0",
"ForeColor": "-65536",
"FontBold": "0",
"FontItalic": "0",
"FontStrikeout": "0"
}]
};
 
var esgridInfo = esUIHelper.winGridInfoToESGridInfo(inGroupID, inFilterID, gridexInfo);
```
* __The result will be:__
```js
{
"id": "ESMMStockItem_Def",
"caption": "Είδη Αποθήκης",
"rootTable": "ESFIItem",
"selectedMasterTable": "ESFIItem",
"selectedMasterField": "ISUDGID",
"totalRow": "0",
"columnHeaders": "0",
"columnSetHeaders": "0",
"columnSetRowCount": "2",
"columnSetHeaderLines": "1",
"headerLines": "1",
"groupByBoxVisible": "false",
"filterLineVisible": "false",
"previewRow": "false",
"previewRowMember": "",
"previewRowLines": "3",
"columns": [{
"field": "Code",
"title": "Κωδικός"
}, {
"field": "ESDCreated",
"title": "Ημ/νία δημιουργίας",
"format": "{0:d}"
}, {
"field": "ESDModified",
"title": "Ημ/νία τελ.μεταβολής",
"format": "{0:d}"
}, {
"field": "ESUCreated",
"title": "Χρήστης δημιουργίας"
}, {
"field": "Description",
"title": "Περιγραφή"
}, {
"field": "Price",
"title": "Τιμή χονδρικής",
"attributes": {
"style": "text-align: right;"
},
"format": "{0:#,0.00}"
}, {
"field": "RetailPrice",
"title": "Τιμή λιανικής",
"attributes": {
"style": "text-align: right;"
},
"format": "{0:#,0.00}"
}, {
"field": "AssemblyType",
"title": "Τύπος σύνθεσης"
}, {
"field": "ItemClass",
"title": "Κλάση"
}, {
"field": "ItemType",
"title": "Τύπος"
}, {
"field": "Name",
"title": "Επωνυμία/Ονοματεπώνυμο"
}, {
"field": "Description1",
"title": "Περιγραφή1"
}, {
"field": "fItemFamilyCode",
"title": "Οικογένεια"
}, {
"field": "fItemGroupCode",
"title": "Ομάδα"
}, {
"field": "fItemCategoryCode",
"title": "Κατηγορία"
}, {
"field": "fItemSubcategoryCode",
"title": "Υποκατηγορία"
}, {
"field": "ESUModified",
"title": "Χρήστης τελ.μεταβολής"
}, {
"field": "Comment",
"title": "Σχόλιο"
}],
"params": [{
"id": "ESDCreated",
"aa": 1,
"caption": "Ημ/νία δημιουργίας",
"toolTip": "Ημ/νία δημιουργίας",
"controlType": 6,
"parameterType": "Entersoft.Framework.Platform.ESDateRange, QueryProcess",
"precision": 0,
"multiValued": false,
"visible": true,
"required": false,
"oDSTag": "AA049FD6-4EFF-499F-8F6B-0573BD14D183",
"tags": "",
"visibility": 0,
"defaultValues": {
"paramCode": "ESDCreated",
"paramValue": {
"dRange": "1",
"fromD": "2006-04-14T21:00:00.000Z",
"toD": null
}
}
}, {
"id": "ESUCreated",
"aa": 2,
"caption": "Χρήστης δημιουργίας",
"toolTip": "Χρήστης δημιουργίας",
"controlType": 9,
"parameterType": "Entersoft.Framework.Platform.ESString, QueryProcess",
"precision": 0,
"multiValued": false,
"visible": true,
"required": false,
"oDSTag": "0ABDC77C-119B-4729-A99F-C226EBCE0C1B",
"tags": "",
"visibility": 0,
"defaultValues": {
"paramCode": "ESUCreated",
"paramValue": {
"value": "wλμ",
"valueTo": "χχω",
"oper": "RANGE"
}
}
}, {
"id": "ESDModified",
"aa": 3,
"caption": "Ημ/νία τελ.μεταβολής",
"toolTip": "Ημ/νία τελ.μεταβολής",
"controlType": 20,
"parameterType": "Entersoft.Framework.Platform.ESDateRange, QueryProcess",
"precision": 0,
"multiValued": false,
"visible": true,
"required": false,
"oDSTag": "4E4E17A4-ECA5-4CB0-9F11-02C943F6E6C8",
"tags": "",
"visibility": 0,
"defaultValues": {
"paramCode": "ESDModified",
"paramValue": {
"dRange": "1",
"fromD": "2011-03-13T22:00:00.000Z",
"toD": null
}
}
}],
"defaultValues": {
"ESDCreated": {
"paramCode": "ESDCreated",
"paramValue": {
"dRange": "1",
"fromD": "2006-04-14T21:00:00.000Z",
"toD": null
}
},
"ESUCreated": {
"paramCode": "ESUCreated",
"paramValue": {
"value": "wλμ",
"valueTo": "χχω",
"oper": "RANGE"
}
},
"ESDModified": {
"paramCode": "ESDModified",
"paramValue": {
"dRange": "1",
"fromD": "2011-03-13T22:00:00.000Z",
"toD": null
}
}
}
}
```
**/
                winGridInfoToESGridInfo: winGridInfoToESGridInfo,

                winColToESCol: winColToESCol,
                esColToKCol: esColToKCol,
                esGridInfoToLocalKInfo: esGridInfoToLocalKInfo,

                /**
* @ngdoc function
* @name es.Web.UI.esUIHelper#esGridInfoToKInfo
* @methodOf es.Web.UI.esUIHelper
* @module es.Web.UI
* @kind function
* @description  This function processes and transforms an {@link es.Web.UI.esUIHelper#methods_winGridInfoToESGridInfo esgridInfo} object (abstract definition of gridexInfo)
* to a Telerik kendo-grid layout definition object.
* @param {string} inGroupID The Entersoft PQ (or Scroller) GroupID the the gridexInfo object describes
* @param {string} inFilterID The Entersoft PQ (or Scroller) FilterID the the gridexInfo object describes
* @param {object} executeParams The object that will hold or alread holds the values of the Entersoft Public Query Paramters i.e. the object
* that holds the values of the params panel (EBS terminology). If the object is not an empty one i.e. {} BUT is has values for some of the named parameters
* these values will be used as default values for those parameters, overiding any default values coming from the grid layout definition object.
* @param {object} esGridInfo The Entersoft abstract definition object that is the result of {@link es.Web.UI.esUIHelper#methods_winGridInfoToESGridInfo winGridInfoToESGridInfo}.
* of the function {@link es.Services.Web.esWebApi#methods_fetchPublicQueryInfo fetchPublicQueryInfo}.
* @return {object} Returns an object that is the __Telerik kendo-grid specific__ schema definition object that can be used to initialize the
* UI of a kendo-grid or kendo-grid like widget.
*
* The returned object can be directly assigned to the _k-options_ attribute of a __kendo-grid__ Telerik widget
* @example
* This is a screenshot from Pulic Query Info results (geridexInfo, esgridInfo and Telerik kendo-grid options)
* ![Sample run for am ESMMStockItem PQInfo](images/api/es010fetchpqinfo.png)
* 
```js
//fetchPublicQueryInfo sample
$scope.fetchPQInfo = function() {
esWebApi.fetchPublicQueryInfo($scope.pGroup, $scope.pFilter)
.then(function(ret) {
// This is the gridlayout as defined in the EBS Public Query based on .NET Janus GridEx Layout
$scope.esJanusGridLayout = ret.data;
 
// This is the neutral-abstract representation of the Janus GridEx Layout according to the ES WEB UI simplification
$scope.esWebGridInfo = esWebUIHelper.winGridInfoToESGridInfo($scope.pGroup, $scope.pFilter, $scope.esJanusGridLayout);
 
// This is the kendo-grid based layout ready to be assigned to kendo-grid options attribute for rendering the results
// and for executing the corresponding Public Query
$scope.esGridOptions = esWebUIHelper.esGridInfoToKInfo($scope.pGroup, $scope.pFilter, {}, $scope.esWebGridInfo);
}, function(err, status) {
alert(a.UserMessage || a.MessageID || "Generic Error");
});
}
```
* __HTML__
```html
<span>
<input type="text" ng-model="pGroup"  placeholder="PQ GroupID">
<input type="text" ng-model="pFilter" placeholder="PQ FilterID">
<button ng-click="fetchPQInfo()">fetchPublicQueryInfo</button>
<div kendo-grid k-ng-delay="esGridOptions" k-auto-bind="false" k-options="esGridOptions" />
</span>
```
**/
                esGridInfoToKInfo: esGridInfoToKInfo,

                getZoomDataSource: prepareStdZoom,
                getPQDataSource: prepareWebScroller,
                getTreeMapDS: getTreeMapDS,

                getPivotDS: getPivotDS,

                esResolveBlobUrl: esResolveBlobUrl,

                esResolveUserLogoUrl: esResolveUserLogoUrl,

                createEsParamVal: createEsParamVal,

                createESParams: createESParams,

                ESParamsDefinitions: ESParamsDefinitions,

                ESParamInfo: ESParamInfo,

                esAskForField: esAskForField,

                esChangePassword: esChangePassword,

                ESFavourites: ESFavourites,

                onMapClick: function (a, b, c) {
                    alert(
                        "A location has been clicked. Soon you will see a form here !!!"
                    );
                },
            };
        },
    ]);
})();
