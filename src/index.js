const core = require('@actions/core')
const github = require('@actions/github')
const VersionBuilder = require('./versionBuilder')

async function run(octokit, context, versionPrefix, versionSeparator) {
    const { owner, repo } = context.repo
    const { data: milestones } = await octokit.rest.issues.listMilestones({
        owner,
        repo,
    })
    const versionBuilder = new VersionBuilder(versionPrefix, versionSeparator)
    milestones.forEach(m => {
        const version = versionBuilder.build(m.title)
        if (version) {
            m._version = version
        }
    })
    const matchedMilestones = milestones.filter(m => m._version).sort((a, b) => a._version.compare(b._version))
    if (!matchedMilestones) {
        throw new Error('No matched milestones.')
    }

    core.debug("Matched milestones: " + matchedMilestones.toString());

    // assign to max active version
    const milestone = matchedMilestones[matchedMilestones.length - 1]
    core.debug("Max version: " + milestone._version);

    const { issue, pull_request } = context.payload
    return octokit.rest.issues.update({
        milestone: milestone.number,
        issue_number: (issue || pull_request).number,
        owner,
        repo,
    })
}

async function main() {
    try {
        const octokit = github.getOctokit(core.getInput('github-token'))
        const versionPrefix = core.getInput('version-prefix')
        const versionSeparator = core.getInput('version-separator')
        const overwrite = core.getBooleanInput('overwrite')

        const { issue, pull_request } = github.context.payload;
        if (!overwrite && (issue || pull_request).milestone) {
            core.info("A milestone exists. Do nothing.");
            return;
        }

        const { data: { milestone } } = await run(octokit, github.context, versionPrefix, versionSeparator)
        core.setOutput('milestone-number', milestone.number)
        core.setOutput('milestone-title', milestone.title)
    } catch (error) {
        core.setFailed(error.message)
    }
}
main()
