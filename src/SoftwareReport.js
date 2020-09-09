
module.exports = class SoftwareReport {

  constructor(data) {
    this._sarifReport = data.report;

    this._dependencies = {
      vulnerabilities: data.vulnerabilities || [],
      dependencies: data.dependencies || [],
    };

    this._codeScanning = {
      open: data.openScans || [],
      closed: data.closedScans || [],
    };
  }

  get vulnerabilities() {
    return this._dependencies.vulnerabilities;
  }

  get dependencies() {
    return this._dependencies.dependencies;
  }

  get openVulnerabilities() {
    return this.vulnerabilities.filter(vuln => {return !vuln.isDismissed});
  }

  get openScanResults() {
    return this._codeScanning.open;
  }

  get closedScanResults() {
    return this._codeScanning.closed;
  }

  get codeScanningRules() {
    const result = {}
      , rules = this.sarifReport.rules
      ;

    if (rules) {
      rules.forEach(rule => {
        result[rule.id] = rule;
      });
    }

    return result;
  }

  get sarifReport() {
    //TODO This is currently a {file: payload:} object as there can be mutiple reports but this class does nto cater for it
    return this._sarifReport.payload;
  }

  getPayload() {
    return {
      dependencies: {
        deps: this.getDependencySummary(),
        vulnerabilities: this.getThirdPartyComponentSummary()
      },
      codeScanning: {
        cwes: this.sarifReport.cweList,
        rules: this.getRulesSummary(),
        open: this.getCodeScanSummary(),
      }
    }
  }

  // getAllCWEs() {
  //   const cwes = this.sarifReport.cweList;
  //
  //   return {
  //     cwes: cwes
  //   };
  // }

  getDependencySummary() {
    const unprocessed= []
      , processed = []
      , dependencies = {}
    ;

    let totalDeps = 0;

    this.dependencies.forEach(depSet => {
      totalDeps += depSet.count;

      const manifest = {
        filename: depSet.filename,
        path: depSet.path
      };

      if (depSet.isValid) {
        processed.push(manifest);
      } else {
        unprocessed.push(manifest);
      }

      const identifiedDeps = depSet.dependencies;
      if (identifiedDeps) {
        identifiedDeps.forEach(dep => {
          const type = dep.packageType.toLowerCase();

          if (! dependencies[type]) {
            dependencies[type] = [];
          }

          dependencies[type].push({
            name: dep.name,
            type: dep.packageType,
            version: dep.version,
          })
        })
      }
    });

    return {
      manifests: {
        processed: processed,
        unprocessed: unprocessed,
      },
      totalDependencies: totalDeps,
      dependencies: dependencies
    };
  }

  getThirdPartyComponentSummary() {
    const result = {
      'CRITICAL': [],
      'HIGH': [],
      'LOW': [],
      'MODERATE': [],
    }

    // Obtain third party artifacts ranked by severity
    this.openVulnerabilities.forEach(vulnerability => {
      result[vulnerability.severity].push(vulnerability);
    });

    return result;
  }

  getRulesSummary() {
    const rules = this.codeScanningRules
      , result = []
      ;

    if (rules) {
      Object.values(rules).forEach(rule => {
        result.push({
          name: rule.name,
          //TODO maybe id?
          severity: rule.severity,
          precision: rule.precision,
          kind: rule.kind,
          shortDescription: rule.shortDescription,
          description: rule.description,
          tags: rule.tags, //.join(', '),
          cwe: rule.cwes, //.join(', '),
        });
      });
    }

    return result;
  }

  getCodeScanSummary() {
    const open = this.openScanResults
      , rules = this.codeScanningRules
      , result = {}
    ;

    if (open['CodeQL']) {
      open['CodeQL'].forEach(codeScan => {
        const severity = codeScan.rule_severity
          , matchedRule = rules[codeScan.rule_id]
        ;

        const summary = {
          tool: codeScan.tool,
          name: codeScan.rule_description,
          open: codeScan.open,
          created: codeScan.created_at,
          url: codeScan.url,
          rule: {
            id: codeScan.rule_id,
          }
        }

        if (matchedRule) {
          summary.rule.details = {
            name: matchedRule.name,
            shortDescription: matchedRule.shortDescription,
            description: matchedRule.description,
            tags: matchedRule.tags,
            cwes: matchedRule.cwes,
          }
        }

        if (!result[severity]) {
          result[severity] = [];
        }
        result[severity].push(summary);
      });
    }

    return result;
  }
}